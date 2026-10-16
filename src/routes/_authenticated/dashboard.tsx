import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, Play, Square, AlertTriangle, CalendarDays, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager, formatDuration, type Profile } from "@/lib/profile";
import { AppShell, StatusBadge, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FieldOps" },
      { name: "description", content: "Your FieldOps day at a glance: shifts, jobs and operations." },
      { property: "og:title", content: "Dashboard — FieldOps" },
      { property: "og:description", content: "Your FieldOps day at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile, isLoading } = useProfile();
  if (isLoading) return <AppShell title="Loading…"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!profile)
    return (
      <AppShell title="Welcome">
        <EmptyState>Your account isn't linked to a company yet. Ask your company admin to add you.</EmptyState>
      </AppShell>
    );
  return isManager(profile) ? <ManagerOverview profile={profile} /> : <TechToday profile={profile} />;
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

export function ShiftTracker({ profile }: { profile: Profile }) {
  useTick();
  const qc = useQueryClient();
  const { data: open = [] } = useQuery({
    queryKey: ["open-shifts", profile.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").eq("user_id", profile.id).is("ended_at", null);
      if (error) throw error;
      return data;
    },
  });
  const shift = open.find((s) => s.shift_type === "shift");
  const travel = open.find((s) => s.shift_type === "travel");

  const toggle = async (type: "shift" | "travel", current?: { id: string }) => {
    const res = current
      ? await supabase.from("shifts").update({ ended_at: new Date().toISOString() }).eq("id", current.id)
      : await supabase.from("shifts").insert({ shift_type: type, company_id: profile.company_id, user_id: profile.id });
    if (res.error) return toast.error(res.error.message);
    if (type === "shift" && current && travel) await supabase.from("shifts").update({ ended_at: new Date().toISOString() }).eq("id", travel.id);
    qc.invalidateQueries({ queryKey: ["open-shifts", profile.id] });
    toast.success(current ? (type === "shift" ? "Clocked out" : "Travel stopped") : type === "shift" ? "Clocked in" : "Travel started");
  };

  return (
    <section className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <button
        onClick={() => toggle("shift", shift)}
        className={`flex min-h-32 flex-col justify-between rounded-2xl p-5 text-left transition-transform active:scale-[0.98] ${shift ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}
      >
        <span className="flex items-center gap-2 text-sm font-medium opacity-90">
          {shift ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {shift ? "On shift — tap to clock out" : "Off shift — tap to clock in"}
        </span>
        <span className="font-display text-4xl tabular-nums sm:text-5xl">
          {shift ? formatDuration(Date.now() - new Date(shift.started_at).getTime()) : "00:00:00"}
        </span>
      </button>
      <button
        disabled={!shift}
        onClick={() => toggle("travel", travel)}
        className={`flex min-h-32 flex-col justify-between rounded-2xl border p-5 text-left transition-transform active:scale-[0.98] disabled:opacity-50 ${travel ? "border-warning bg-warning/20" : "bg-card"}`}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Car className="h-4 w-4" /> {travel ? "Travelling — tap to stop" : "Start site travel"}
        </span>
        <span className="font-display text-3xl tabular-nums text-foreground">
          {travel ? formatDuration(Date.now() - new Date(travel.started_at).getTime()) : "—"}
        </span>
      </button>
    </section>
  );
}

function TechToday({ profile }: { profile: Profile }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ["my-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sheets")
        .select("id, status, notes, created_at, clients(name), assets(reference_number, asset_category)")
        .eq("assigned_technician_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const active = jobs.filter((j) => j.status !== "completed");
  return (
    <AppShell title={`Hi, ${profile.full_name.split(" ")[0]}`}>
      <div className="mx-auto max-w-3xl space-y-6">
        <ShiftTracker profile={profile} />
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-foreground">Open jobs ({active.length})</h2>
            <Link to="/jobs" className="text-sm text-primary">All jobs</Link>
          </div>
          {active.length === 0 ? (
            <EmptyState>No open jobs assigned to you.</EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {active.slice(0, 6).map((j) => (
                <Link key={j.id} to="/jobs/$jobId" params={{ jobId: j.id }} className="rounded-xl border bg-card p-4 active:bg-accent">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-foreground">{j.clients?.name}</p>
                    <StatusBadge status={j.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {j.assets ? `${j.assets.reference_number} · ${j.assets.asset_category}` : "No asset"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function ManagerOverview({ profile }: { profile: Profile }) {
  const { data } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const [jobs, inv, leave] = await Promise.all([
        supabase.from("job_sheets").select("id, status, is_overtime, created_at, clients(name), users(full_name)").order("created_at", { ascending: false }),
        supabase.from("inventory_items").select("id, part_name, current_stock, min_stock_level"),
        supabase.from("leave_requests").select("id").eq("status", "pending"),
      ]);
      return { jobs: jobs.data ?? [], inv: inv.data ?? [], pendingLeave: leave.data?.length ?? 0 };
    },
  });
  const jobs = data?.jobs ?? [];
  const low = (data?.inv ?? []).filter((i) => i.current_stock <= i.min_stock_level);
  const count = (s: string) => jobs.filter((j) => j.status === s).length;
  const stats = [
    { label: "Pending", v: count("pending") },
    { label: "In transit", v: count("in_transit") },
    { label: "In progress", v: count("in_progress") },
    { label: "Completed", v: count("completed") },
  ];
  return (
    <AppShell title={profile.companies?.name ?? "Overview"} actions={<Button asChild size="sm"><Link to="/admin/jobs">New job</Link></Button>}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display text-3xl text-foreground">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Link to="/admin/inventory" className="rounded-xl border bg-card p-5">
            <p className="flex items-center gap-2 font-medium text-foreground"><AlertTriangle className="h-4 w-4 text-destructive" /> Low stock</p>
            <p className="mt-1 text-sm text-muted-foreground">{low.length ? low.slice(0, 3).map((i) => i.part_name).join(", ") : "All parts above minimum"}</p>
            <p className="mt-3 font-display text-2xl text-foreground">{low.length} items</p>
          </Link>
          <Link to="/leave" className="rounded-xl border bg-card p-5">
            <p className="flex items-center gap-2 font-medium text-foreground"><CalendarDays className="h-4 w-4 text-primary" /> Leave requests</p>
            <p className="mt-1 text-sm text-muted-foreground">Waiting for approval</p>
            <p className="mt-3 font-display text-2xl text-foreground">{data?.pendingLeave ?? 0} pending</p>
          </Link>
          <Link to="/admin/jobs" className="rounded-xl border bg-card p-5">
            <p className="flex items-center gap-2 font-medium text-foreground"><ClipboardList className="h-4 w-4 text-primary" /> Overtime jobs</p>
            <p className="mt-1 text-sm text-muted-foreground">Flagged as overtime</p>
            <p className="mt-3 font-display text-2xl text-foreground">{jobs.filter((j) => j.is_overtime).length}</p>
          </Link>
        </div>
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-5 py-3 font-medium text-foreground">Recent job sheets</h2>
          {jobs.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No job sheets yet.</p>
          ) : (
            <ul className="divide-y">
              {jobs.slice(0, 8).map((j) => (
                <li key={j.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{j.clients?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{j.users?.full_name ?? "Unassigned"}</p>
                  </div>
                  <StatusBadge status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
