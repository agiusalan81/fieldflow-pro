import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QrCode, Car, Play, Square, AlertTriangle, CalendarDays, ClipboardList, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager, isOffice, formatDuration, type Profile } from "@/lib/profile";
import { useCan } from "@/lib/permissions";
import { useCompanyRules } from "@/lib/company";
import { RenewalList } from "@/components/renewals";
import { AppShell, StatusBadge, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { splitHours, addSplits, DEFAULT_RULES } from "@/lib/jobsheets";
import { AssetHistory, LiftHistoryButton, PriorityBadge, timeWindow } from "@/components/job-card";
import { fileDailyReport, emailDwr, downloadDwr } from "@/lib/dwr-report";
import { InternalWorkCard } from "@/components/work-extras";
import { BillingReview } from "@/components/billing-review";
import { NoAccessButton, DepartureRequests, DepartureAlerts } from "@/components/client-notices";

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
  const { data: company } = useCompanyRules();
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

  const toggle = async (type: "shift" | "travel", current?: { id: string; started_at: string }) => {
    const endedAt = new Date().toISOString();
    const res = current
      ? await supabase.from("shifts").update({ ended_at: endedAt }).eq("id", current.id)
      : await supabase.from("shifts").insert({ shift_type: type, company_id: profile.company_id, user_id: profile.id });
    if (res.error) { toast.error(res.error.message); return; }
    if (type === "shift" && current && travel) await supabase.from("shifts").update({ ended_at: endedAt }).eq("id", travel.id);
    qc.invalidateQueries({ queryKey: ["open-shifts", profile.id] });
    toast.success(current ? (type === "shift" ? "Clocked out" : "Travel stopped") : type === "shift" ? "Clocked in" : "Travel started");
    if (type === "shift" && current && company) {
      try {
        const id = await fileDailyReport({ userId: profile.id, companyId: profile.company_id, shiftId: current.id, startedAt: current.started_at, endedAt, rules: company.rules, breaks: company.breaks });
        const { data: r } = await supabase.from("daily_work_reports").select("*, users(full_name, employee_id)").eq("id", id).single();
        qc.invalidateQueries({ queryKey: ["dwr"] });
        if (r) {
          const name = profile.companies?.name ?? "";
          const mail = await emailDwr(r, name).catch(() => ({ sent: false }));
          toast.success(mail.sent ? "Daily works report emailed to you" : "Daily works report saved", { action: { label: "Download PDF", onClick: () => downloadDwr(r, name) }, duration: 10000 });
        }
      } catch (e) { toast.error(`Couldn't file the daily works report: ${(e as Error).message}`); }
    }
  };

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
      <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${shift ? "bg-success/20 text-foreground" : "bg-muted text-muted-foreground"}`}>
        <span className={`h-2 w-2 rounded-full ${shift ? "bg-success" : "bg-muted-foreground"}`} />
        {shift ? "On shift" : "Off shift"}
        <span className="tabular-nums">{shift ? formatDuration(Date.now() - new Date(shift.started_at).getTime()) : ""}</span>
      </span>
      {travel && <span className="inline-flex h-7 items-center gap-1 rounded-full bg-warning/20 px-2.5 text-xs tabular-nums text-foreground"><Car className="h-3 w-3" />{formatDuration(Date.now() - new Date(travel.started_at).getTime())}</span>}
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant={travel ? "secondary" : "outline"} disabled={!shift} onClick={() => toggle("travel", travel)}>
          <Car className="mr-1 h-4 w-4" />{travel ? "Stop travel" : "Travel"}
        </Button>
        <Button size="sm" variant={shift ? "outline" : "default"} onClick={() => toggle("shift", shift)}>
          {shift ? <Square className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{shift ? "Clock out" : "Clock in"}
        </Button>
      </div>
    </section>
  );
}

function TechToday({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { data: jobs = [] } = useQuery({
    queryKey: ["today-jobs", profile.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, job_number, asset_id, window_start, window_end, problem_summary, priority, acknowledged_at, clients(name), sites(name, address), assets(reference_number, asset_category)")
        .eq("assigned_technician_id", profile.id)
        .eq("scheduled_date", today)
        .order("window_start");
      if (error) throw error;
      return data;
    },
  });


  return (
    <AppShell title={`Hi, ${profile.full_name.split(" ")[0]}`}>
      <div className="mx-auto max-w-4xl space-y-6">
        <ShiftTracker profile={profile} />
        <InternalWorkCard profile={profile} />
        <ScanQr />
        <DepartureAlerts userId={profile.id} />
        <NoAccessButton profile={profile} jobs={jobs} />
        <section>
          <h2 className="mb-3 font-medium text-foreground">Today's jobs ({jobs.length})</h2>
          {jobs.length === 0 ? (
            <EmptyState>No jobs scheduled for you today.</EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {jobs.map((j) => (
                <li key={j.id} className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Job #{j.job_number} · {timeWindow(j.window_start, j.window_end)}</p>
                      <p className="truncate font-medium text-foreground">{j.clients?.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{j.sites?.name ?? "No site"} · {j.assets?.reference_number ?? "No lift"}</p>
                    </div>
                    <PriorityBadge p={j.priority} />
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">{j.problem_summary || "No problem summary"}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="h-11" onClick={() => navigate({ to: "/sheets/new", search: { jobId: j.id } })}><Play className="mr-1 h-4 w-4" />Start</Button>
                    <LiftHistoryButton assetId={j.asset_id} label={`${j.assets?.reference_number ?? ""} · ${j.sites?.name ?? j.clients?.name ?? ""}`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function ScanQr() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ id: string; label: string } | null | "none">(null);
  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from("assets").select("id, reference_number, asset_category, clients(name)").ilike("reference_number", code.trim()).maybeSingle();
    setFound(data ? { id: data.id, label: `${data.reference_number} · ${data.asset_category} · ${data.clients?.name}` } : "none");
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setFound(null); setCode(""); } }}>
      <DialogTrigger asChild><Button variant="outline" className="h-12 w-full"><QrCode className="mr-2 h-5 w-5" />Scan QR Code</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Site lookup</DialogTitle></DialogHeader>
        <form onSubmit={lookup} className="flex gap-2">
          <Input autoFocus className="h-11" placeholder="Scan or type lift reference" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" className="h-11">Look up</Button>
        </form>
        <p className="text-xs text-muted-foreground">Camera scanning is simulated — enter the reference printed under the QR code.</p>
        {found === "none" && <p className="text-sm text-destructive">No lift found with that reference.</p>}
        {found && found !== "none" && <AssetHistory assetId={found.id} label={found.label} />}
      </DialogContent>
    </Dialog>
  );
}

function Card({ to, title, icon: Icon, sub, value }: { to: string; title: string; icon: typeof Car; sub: string; value: string | number }) {
  return (
    <Link to={to} className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Icon className="h-4 w-4 text-primary" />{title}</p>
      <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}

function useOpsData() {
  const today = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: ["overview", today],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [sheets, inv, leave, shifts, jobs, users] = await Promise.all([
        supabase.from("job_sheets").select("id, jobsheet_number, status, requires_admin_approval, pending_works_future_jobs, pending_status, assigned_technician_id, updated_at, clients(name), sites(name), users!job_sheets_assigned_technician_id_fkey(full_name), billing_status, jobsheet_time_logs(log_date, time_in, time_out)").gte("updated_at", since).order("updated_at", { ascending: false }),
        supabase.from("inventory_items").select("id, part_name, current_stock, min_stock_level"),
        supabase.from("leave_requests").select("id").eq("status", "pending"),
        supabase.from("shifts").select("user_id, shift_type, started_at").is("ended_at", null),
        supabase.from("jobs").select("id, job_number, window_start, window_end, priority, assigned_technician_id, clients(name), sites(name)").eq("scheduled_date", today).order("window_start"),
        supabase.from("users").select("id, full_name"),
      ]);
      return { sheets: sheets.data ?? [], inv: inv.data ?? [], pendingLeave: leave.data?.length ?? 0, shifts: shifts.data ?? [], jobs: jobs.data ?? [], users: users.data ?? [] };
    },
  });
}

function ManagerOverview({ profile }: { profile: Profile }) {
  return isOffice(profile) ? <OfficeOverview profile={profile} /> : <SupervisorOverview profile={profile} />;
}

/** Shift clock shown on every manager overview; hours live on the My hours page. */
function MyHours({ profile }: { profile: Profile }) {
  return <><ShiftTracker profile={profile} /><DepartureRequests /></>;
}

function OfficeOverview({ profile }: { profile: Profile }) {
  const can = useCan(profile);
  const navigate = useNavigate();
  const { data } = useOpsData();
  const { data: c } = useCompanyRules();
  const rules = c?.rules ?? DEFAULT_RULES;
  const completed = (data?.sheets ?? []).filter((s) => s.status === "completed");
  const billing = completed.map((s) => ({ s, h: s.jobsheet_time_logs.reduce((a, l) => addSplits(a, splitHours(l.log_date, l.time_in, l.time_out, rules)), { standard: 0, ot15: 0, ot20: 0 }) }));
  const tot = billing.reduce((a, b) => addSplits(a, b.h), { standard: 0, ot15: 0, ot20: 0 });
  const low = (data?.inv ?? []).filter((i) => i.current_stock <= i.min_stock_level);
  const [review, setReview] = useState<string | null>(null);
  return (
    <AppShell title={profile.companies?.name ?? "Overview"} actions={<Button asChild size="sm" variant="outline"><Link to="/company">Company settings</Link></Button>}>
      <div className="space-y-6">
        <MyHours profile={profile} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {can("billing") && <Card to="/admin/jobs" title="Completed (30 days)" icon={ClipboardList} value={completed.length} sub={`${tot.standard} h std · ${tot.ot15} h 1.5× · ${tot.ot20} h 2×`} />}
          {can("billing") && <Card to="/admin/jobs" title="Overtime hours" icon={Clock} value={(tot.ot15 + tot.ot20).toFixed(2)} sub="1.5× and 2× in the last 30 days" />}
          {can("leave_approvals") && <Card to="/leave" title="Leave requests" icon={CalendarDays} value={data?.pendingLeave ?? 0} sub="Waiting for approval" />}
          {can("inventory") && <Card to="/admin/inventory" title="Low stock" icon={AlertTriangle} value={low.length} sub={low.slice(0, 2).map((i) => i.part_name).join(", ") || "All parts above minimum"} />}
        </div>
        {can("contracts") && (
          <section className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="font-medium text-foreground">Contracts due for renewal</h2><Link to="/contracts" className="text-sm text-primary">All contracts</Link></div>
            <RenewalList office limit={5} />
          </section>
        )}
        {can("billing") && (
          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3 font-medium text-foreground">Ready for billing <span className="text-xs font-normal text-muted-foreground">— tap a sheet to review before it goes to accounting</span></h2>
            {!billing.length ? <p className="p-5 text-sm text-muted-foreground">No completed job sheets in the last 30 days.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th className="px-5 py-2 font-medium">Sheet</th><th className="px-3 py-2 font-medium">Client</th><th className="px-3 py-2 font-medium">Technician</th><th className="px-3 py-2 text-right font-medium">Std</th><th className="px-3 py-2 text-right font-medium">1.5×</th><th className="px-3 py-2 text-right font-medium">2×</th><th className="px-3 py-2 font-medium">Billing</th></tr></thead>
                  <tbody className="divide-y">
                    {billing.slice(0, 10).map(({ s, h }) => (
                      <tr key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setReview(s.id)}>
                        <td className="px-5 py-2.5 font-mono text-primary">#{s.jobsheet_number}</td><td className="px-3 py-2.5 text-foreground">{s.clients?.name}</td><td className="px-3 py-2.5 text-muted-foreground">{s.users?.full_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{h.standard}</td><td className="px-3 py-2.5 text-right tabular-nums">{h.ot15}</td><td className="px-3 py-2.5 text-right tabular-nums">{h.ot20}</td><td className="px-3 py-2.5 text-xs capitalize text-muted-foreground">{s.billing_status === "unreviewed" ? "To review" : s.billing_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
      <BillingReview sheetId={review} onClose={() => setReview(null)} />
    </AppShell>
  );
}

function SupervisorOverview({ profile }: { profile: Profile }) {
  const can = useCan(profile);
  const navigate = useNavigate();
  const { data } = useOpsData();
  const sheets = data?.sheets ?? [];
  const approvals = sheets.filter((s) => s.requires_admin_approval).length;
  const pending = sheets.filter((s) => (s.pending_works_future_jobs ?? "").trim() && s.pending_status !== "done").length;
  const name = (id: string | null) => data?.users.find((u) => u.id === id)?.full_name ?? "Unassigned";
  const techs = (data?.users ?? []).map((u) => {
    const sh = data!.shifts.filter((x) => x.user_id === u.id);
    const active = sheets.find((s) => s.assigned_technician_id === u.id && (s.status === "in_transit" || s.status === "in_progress"));
    const status = active?.status === "in_progress" ? `On site · ${active.clients?.name}` : active?.status === "in_transit" || sh.some((x) => x.shift_type === "travel") ? `Travelling${active ? ` · ${active.clients?.name}` : ""}` : sh.some((x) => x.shift_type === "shift") ? "On shift · available" : "Off shift";
    return { u, status, on: sh.length > 0 || !!active };
  }).sort((a, b) => Number(b.on) - Number(a.on));
  const done = sheets.filter((s) => s.status === "completed" && s.updated_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  return (
    <AppShell title="Field command" actions={<Button asChild size="sm" variant="outline"><Link to="/admin/jobs" search={{ new: true }}>Dispatch job</Link></Button>}>
      <div className="space-y-6">
        <MyHours profile={profile} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {can("live_status") && <Card to="/dashboard" title="Technicians active" icon={Play} value={techs.filter((t) => t.on).length} sub={`of ${techs.length} team members`} />}
          {can("dispatch") && <Card to="/admin/jobs" title="Today's jobs" icon={CalendarDays} value={data?.jobs.length ?? 0} sub={`${done} sheets completed today`} />}
          {can("approvals") && <Card to="/admin/jobs" title="Asset approvals" icon={AlertTriangle} value={approvals} sub="Model / serial changes to check" />}
          {can("pending_works") && <Card to="/pending-works" title="Pending works" icon={ClipboardList} value={pending} sub="Follow-ups to schedule or quote" />}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {can("live_status") && (
            <section className="rounded-xl border bg-card">
              <h2 className="border-b px-5 py-3 font-medium text-foreground">Live technician status</h2>
              <ul className="divide-y">
                {techs.map(({ u, status, on }) => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-success" : "bg-muted-foreground"}`} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{u.full_name}</span>
                    <span className="truncate text-muted-foreground">{status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {can("dispatch") && (
            <section className="rounded-xl border bg-card">
              <h2 className="border-b px-5 py-3 font-medium text-foreground">Today's dispatch</h2>
              {!data?.jobs.length ? <p className="p-5 text-sm text-muted-foreground">No jobs scheduled today.</p> : (
                <ul className="divide-y">
                  {data.jobs.map((j) => (
                    <li key={j.id} className="grid cursor-pointer grid-cols-[90px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/50" onClick={() => navigate({ to: "/admin/jobs" })}>
                      <span className="tabular-nums text-muted-foreground">{timeWindow(j.window_start, j.window_end)}</span>
                      <span className="min-w-0 truncate text-foreground">#{j.job_number} · {j.clients?.name}{j.sites?.name ? ` · ${j.sites.name}` : ""}<span className="block truncate text-xs text-muted-foreground">{name(j.assigned_technician_id)}</span></span>
                      <PriorityBadge p={j.priority} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-5 py-3 font-medium text-foreground">Recent job sheets</h2>
          <ul className="divide-y">
            {sheets.slice(0, 8).map((j) => (
              <li key={j.id} className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 hover:bg-muted/50" onClick={() => navigate({ to: "/sheets/$sheetId", params: { sheetId: j.id } })}>
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">#{j.jobsheet_number} · {j.clients?.name}</p><p className="truncate text-xs text-muted-foreground">{j.users?.full_name ?? "Unassigned"}</p></div>
                <StatusBadge status={j.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
