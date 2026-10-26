import { AttentionOverview } from "@/components/attention-overview";
import { ApprovalsBanner } from "@/components/approvals-banner";
import { LiveLocations } from "@/components/live-locations";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { assignmentFilter, isAssisting, splitHours, addSplits, DEFAULT_RULES } from "@/lib/jobsheets";
import { AssetHistory, LiftHistoryButton, PriorityBadge, timeWindow } from "@/components/job-card";
import { formatPlate } from "@/lib/dwr";
import { ShiftClockInDialog } from "@/components/shift-clock-in-dialog";
import { clockInShift } from "@/lib/shift-clock-in";
import { closeShiftReport, reconcileShifts, downloadDwr } from "@/lib/dwr-report";
import { InternalWorkCard } from "@/components/work-extras";
import { BillingReview } from "@/components/billing-review";
import { NoAccessButton, DepartureRequests } from "@/components/client-notices";
import { usePreviewProfile, useUserPreview } from "@/lib/impersonation";
import { JobTravelActions } from "@/components/job-travel-actions";
import { UnfinishedWorkDialog } from "@/components/unfinished-work";
import { captureShiftLocation } from '@/lib/shift-location';
import { usePlanFeatures } from "@/lib/plan-features";
import { alarmJobs, chime, OPEN_JOB_ALARM_MS } from "@/lib/open-job-alarm";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Dashboard — FieldBridge" },
      { name: "description", content: "Your FieldBridge day at a glance: shifts, jobs and operations." },
      { property: "og:title", content: "Dashboard — FieldBridge" },
      { property: "og:description", content: "Your FieldBridge day at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile, isLoading, isPreview } = usePreviewProfile();
  if (isLoading) return <AppShell title="Loading…"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!profile)
    return (
      <AppShell title="Welcome">
        <EmptyState>Your account isn't linked to a company yet. Ask your company admin to add you.</EmptyState>
      </AppShell>
    );
  return isManager(profile) ? <ManagerOverview profile={profile} /> : <TechToday profile={profile} readOnly={isPreview} />;
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

export function ShiftTracker({ profile }: { profile: Profile }) {
  const { data: actor } = useProfile();
  const { active: readOnly } = useUserPreview(actor);
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
  const reconciled = useRef(false);
  useEffect(() => {
    if (readOnly || !company || reconciled.current) return;
    reconciled.current = true;
    reconcileShifts({ userId: profile.id, companyId: profile.company_id, company, companyName: profile.companies?.name ?? "" })
      .then((m) => { if (m.length) { m.forEach((x) => toast.info(x, { duration: 10000 })); qc.invalidateQueries({ queryKey: ["open-shifts", profile.id] }); qc.invalidateQueries({ queryKey: ["dwr"] }); } })
      .catch(() => {});
  }, [readOnly, company, profile, qc]);
  const shift = open.find((s) => s.shift_type === "shift");
  const travel = open.find((s) => s.shift_type === "travel");

  const [plateOpen, setPlateOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const toggle = async (type: "shift" | "travel", current?: { id: string; started_at: string }, vehicle?: string) => {
    if (readOnly) return;
    if(type==='shift'&&current)await captureShiftLocation(profile,current.id,'clock_out');
    const endedAt = new Date().toISOString();
    const res = current
      ? await supabase.from("shifts").update({ ended_at: endedAt }).eq("id", current.id)
      : type === "shift"
        ? await clockInShift(profile, vehicle ?? "").then(() => ({ error: null }))
        : await supabase.from("shifts").insert({ shift_type: type, company_id: profile.company_id, user_id: profile.id });
    if (res.error) { toast.error(res.error.message); return; }
    if (type === "shift" && current && travel) await supabase.from("shifts").update({ ended_at: endedAt }).eq("id", travel.id);
    qc.invalidateQueries({ queryKey: ["open-shifts", profile.id] });
    toast.success(current ? (type === "shift" ? "Clocked out" : "Travel stopped") : type === "shift" ? "Clocked in" : "Travel started");
    if (type === "shift" && !current && company) {
      reconcileShifts({ userId: profile.id, companyId: profile.company_id, company, companyName: profile.companies?.name ?? "", force: true }).then((m) => m.forEach((x) => toast.info(x))).catch(() => {});
    }
    if (type === "shift" && current && company) {
      try {
        const name = profile.companies?.name ?? "";
        const res = await closeShiftReport({ userId: profile.id, companyId: profile.company_id, shift: { ...current, ended_at: null }, endedAt, company, companyName: name });
        qc.invalidateQueries({ queryKey: ["dwr"] });
        if (res.held) toast.success("You're on standby tonight — callouts will be added and your daily works report sent at tomorrow's start time.", { duration: 10000 });
        else if (res.report) { const r = res.report; toast.success("Daily works report filed — ready to view in My daily reports", { action: { label: "View PDF", onClick: () => downloadDwr(r, name) }, duration: 10000 }); }
      } catch (e) { toast.error(`Couldn't file the daily works report: ${(e as Error).message}`); }
    }
  };

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
      <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${shift ? "bg-success/20 text-foreground" : "bg-muted text-muted-foreground"}`}>
        <span className={`h-2 w-2 rounded-full ${shift ? "bg-success" : "bg-muted-foreground"}`} />
        {shift ? "On shift" : "Off shift"}
        {shift?.vehicle_reg && <span className="text-muted-foreground">· {formatPlate(shift.vehicle_reg)}</span>}
        <span className="tabular-nums">{shift ? formatDuration(Date.now() - new Date(shift.started_at).getTime()) : ""}</span>
      </span>
      {travel && <span className="inline-flex h-7 items-center gap-1 rounded-full bg-warning/20 px-2.5 text-xs tabular-nums text-foreground"><Car className="h-3 w-3" />{formatDuration(Date.now() - new Date(travel.started_at).getTime())}</span>}
      <div className="ml-auto flex gap-2">
        <Button data-tour="clock-in" size="sm" variant={shift ? "outline" : "default"} disabled={readOnly} onClick={() => (shift ? setCloseOpen(true) : setPlateOpen(true))}>
          {shift ? <Square className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{shift ? "Clock out" : "Clock in"}
        </Button>
      </div>
      {closeOpen && shift && <UnfinishedWorkDialog profile={profile} onCancel={() => setCloseOpen(false)} onDone={() => { setCloseOpen(false); void toggle("shift", shift); }} />}
      <ShiftClockInDialog userId={profile.id} open={plateOpen} onOpenChange={setPlateOpen} onConfirm={plate => toggle("shift", undefined, plate)} />
    </section>
  );
}

type OpenJob = { id: string; job_number: number; client_name: string | null; site_name: string | null; scheduled_date: string; window_start: string | null; window_end: string | null; priority: string; problem_summary: string | null; places_left: number; required_team_size: number; skills: string[] | null };

/** Open-to-claim jobs for clocked-in field staff, with a repeating 5-minute alarm until claimed or dismissed. */
function UpForGrabs({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const feature = usePlanFeatures(true);
  const smart = feature("skills_dispatch");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const clocked = useQuery({
    queryKey: ["my-open-shift", profile.id],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("shifts").select("id").eq("user_id", profile.id).is("ended_at", null).in("shift_type", ["shift", "standby"]).limit(1);
      return (data ?? []).length > 0;
    },
  });
  const jobs = useQuery({
    queryKey: ["open-jobs"],
    enabled: smart,
    refetchInterval: 30_000,
    queryFn: async () => { const r = await supabase.rpc("open_jobs_for_me"); if (r.error) throw r.error; return (r.data ?? []) as OpenJob[]; },
  });
  const alerting = alarmJobs(jobs.data ?? [], dismissed);
  const ringing = smart && clocked.data === true && alerting.length > 0;
  useEffect(() => {
    if (!ringing) return;
    chime();
    const t = setInterval(chime, OPEN_JOB_ALARM_MS);
    return () => clearInterval(t);
  }, [ringing, alerting.map((j) => j.id).join(",")]);
  if (!smart || !(jobs.data ?? []).length) return null;
  const claim = async (id: string) => {
    setBusy(id);
    const r = await supabase.rpc("claim_open_job", { _job: id });
    setBusy(null);
    if (r.error) toast.error(r.error.message);
    else { toast.success(r.data === "lead" ? "Job claimed — you are the lead" : "You joined the crew"); setDismissed((s) => new Set([...s, id])); }
    qc.invalidateQueries({ queryKey: ["open-jobs"] }); qc.invalidateQueries({ queryKey: ["today-jobs"] }); qc.invalidateQueries({ queryKey: ["schedule"] });
  };
  return (
    <section className="space-y-3 rounded-xl border-2 border-warning bg-warning/10 p-4" aria-label="Jobs up for grabs">
      <div className="flex items-center gap-2">
        <Megaphone className={`h-5 w-5 text-warning ${ringing ? "animate-pulse" : ""}`} />
        <h2 className="font-medium text-foreground">Up for grabs ({alerting.length || (jobs.data ?? []).length})</h2>
        {ringing && <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-medium text-warning-foreground">Alarm every 5 min until claimed</span>}
      </div>
      {!clocked.data && <p className="text-sm text-muted-foreground">Clock in to claim these jobs.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {(jobs.data ?? []).map((j) => (
          <li key={j.id} className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">#{j.job_number} · {j.client_name ?? "Client"}{j.site_name ? ` · ${j.site_name}` : ""}</p>
                <p className="text-xs text-muted-foreground">{j.scheduled_date}{j.window_start ? ` · ${timeWindow(j.window_start, j.window_end)}` : ""} · <span className="capitalize">{j.priority}</span></p>
              </div>
              <span className="shrink-0 rounded-md border bg-muted px-2 py-1 text-xs">{j.places_left} of {j.required_team_size} left</span>
            </div>
            {j.problem_summary && <p className="line-clamp-2 text-sm text-foreground">{j.problem_summary}</p>}
            {smart && <div className="flex flex-wrap items-center gap-1"><span className="text-xs text-muted-foreground">Required skills:</span>{!j.skills?.length&&<span className="text-xs">None specified</span>}{(j.skills??[]).map((s) => <span key={s} className="rounded-full border px-2 py-0.5 text-xs">{s}</span>)}</div>}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" disabled={busy !== null || !clocked.data} onClick={() => claim(j.id)}>{busy === j.id ? "Claiming…" : "Claim job"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissed((s) => new Set([...s, j.id]))}>Dismiss</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TechToday({ profile, readOnly, switcher }: { profile: Profile; readOnly: boolean; switcher?: ReactNode }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { data: jobs = [] } = useQuery({
    queryKey: ["today-jobs", profile.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, assigned_technician_id, secondary_technician_id, job_number, asset_id, window_start, window_end, problem_summary, priority, acknowledged_at, clients(name), sites(name, address), assets(reference_number, asset_category)")
        .or(assignmentFilter(profile.id))
        .eq("scheduled_date", today)
        .order("window_start");
      if (error) throw error;
      return data;
    },
  });


  return (
    <AppShell title={`Hi, ${profile.full_name.split(" ")[0]}`} actions={switcher}>
      <div className="mx-auto max-w-4xl space-y-6">
        <ShiftTracker profile={profile} />{switcher && !readOnly && <DepartureRequests />}
        {!readOnly && <UpForGrabs profile={profile} />}
        <InternalWorkCard key={profile.id} profile={profile} readOnly={readOnly} />
        <Button asChild variant="outline" className="h-12 w-full"><Link to="/technical-library"><ClipboardList className="mr-2 h-5 w-5" />Technical library</Link></Button>
        <ScanQr />
        {!readOnly && <NoAccessButton profile={profile} jobs={jobs} />}
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
                      <p className="text-xs font-medium text-primary">{isAssisting(j, profile.id) ? "Assisting" : "Lead"}</p><p className="text-xs text-muted-foreground">Job #{j.job_number} · {timeWindow(j.window_start, j.window_end)}</p>
                      <p className="truncate font-medium text-foreground">{j.clients?.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{j.sites?.name ?? "No site"} · {j.assets?.reference_number ?? "No lift"}</p>
                    </div>
                    <PriorityBadge p={j.priority} />
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">{j.problem_summary || "No problem summary"}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <JobTravelActions profile={profile} jobId={j.id} address={j.sites?.address} readOnly={readOnly} assisting={isAssisting(j, profile.id)} />
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
        supabase.from("jobs").select("id, job_number, window_start, window_end, priority, assigned_technician_id, secondary_technician_id, clients(name), sites(name)").eq("scheduled_date", today).order("window_start"),
        supabase.from("users").select("id, full_name"),
      ]);
      return { sheets: sheets.data ?? [], inv: inv.data ?? [], pendingLeave: leave.data?.length ?? 0, shifts: shifts.data ?? [], jobs: jobs.data ?? [], users: users.data ?? [] };
    },
  });
}

function ManagerOverview({ profile }: { profile: Profile }) {
  return isOffice(profile) ? <OfficeOverview profile={profile} /> : <SupervisorHome profile={profile} />;
}

/** Supervisors switch between their own day (same as a technician) and team command. */
function SupervisorHome({ profile }: { profile: Profile }) {
  const { isPreview } = usePreviewProfile();
  const [tab, setTab] = useState<"mine" | "team">("mine");
  useEffect(() => { const v = localStorage.getItem("supervisor-tab"); if (v === "team" || v === "mine") setTab(v); }, []);
  const pick = (v: "mine" | "team") => { setTab(v); localStorage.setItem("supervisor-tab", v); };
  const switcher = (
    <div className="flex rounded-md border" role="tablist" aria-label="Dashboard view">
      <Button size="sm" role="tab" aria-selected={tab === "mine"} variant={tab === "mine" ? "secondary" : "ghost"} onClick={() => pick("mine")}>My day</Button>
      <Button size="sm" role="tab" aria-selected={tab === "team"} variant={tab === "team" ? "secondary" : "ghost"} onClick={() => pick("team")}>Team</Button>
    </div>
  );
  return tab === "mine" ? <TechToday profile={profile} readOnly={isPreview} switcher={switcher} /> : <SupervisorOverview profile={profile} switcher={switcher} />;
}

/** Shift clock shown on every manager overview; hours live on the My hours page. */
function MyHours({ profile }: { profile: Profile }) {
  const { data: actor } = useProfile();
  const { active } = useUserPreview(actor);
  return <><ShiftTracker profile={profile} />{!active && <DepartureRequests />}</>;
}

function OfficeOverview({ profile }: { profile: Profile }) {
  return <AppShell title={profile.companies?.name ?? "Overview"} actions={<Button asChild size="sm" variant="outline"><Link to="/company">Company settings</Link></Button>}><div className="mx-auto max-w-5xl space-y-5"><ApprovalsBanner/><ShiftTracker profile={profile}/><AttentionOverview/></div></AppShell>;
}
function SupervisorOverview({ profile, switcher }: { profile: Profile; switcher?: ReactNode }) {
  return <AppShell title="Team attention" actions={switcher}><div className="mx-auto max-w-5xl space-y-5"><ApprovalsBanner/><ShiftTracker profile={profile}/><AttentionOverview/></div></AppShell>;
}
