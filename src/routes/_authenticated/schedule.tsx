import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, FileText, List, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePreviewProfile } from "@/lib/impersonation";
import { AppShell, EmptyState } from "@/components/app-shell";
import { PriorityBadge, timeWindow } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JobTravelActions } from "@/components/job-travel-actions";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Scheduled works — FieldBridge" },
      { name: "description", content: "Your upcoming assignments in a list or calendar." },
      { property: "og:title", content: "Scheduled works — FieldBridge" },
      { property: "og:description", content: "Upcoming assignments." },
    ],
  }),
  component: Schedule,
});

type Job = {
  id: string; job_number: number; scheduled_date: string; window_start: string | null; window_end: string | null;
  problem_summary: string | null; priority: string; acknowledged_at: string | null;
  sheet?: { id: string; status: string; jobsheet_number: string | null } | null;
  clients: { name: string } | null; sites: { name: string; address: string | null } | null; assets: { reference_number: string; asset_category: string } | null;
};

const SCHED: Record<string, [string, string]> = {
  open: ["Open", "bg-muted text-muted-foreground"],
  draft: ["Open", "bg-muted text-muted-foreground"],
  pending: ["Open", "bg-muted text-muted-foreground"],
  in_transit: ["In transit", "bg-warning/25 text-warning-foreground"],
  in_progress: ["In progress", "bg-primary/15 text-primary"],
  completed: ["Closed", "bg-success/15 text-success"],
};
const schedStatus = (j: Job) => SCHED[j.sheet?.status ?? "open"] ?? SCHED["open"]!;

function Schedule() {
  const { data: profile, isPreview } = usePreviewProfile();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [detail, setDetail] = useState<Job | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = new Date().toISOString().slice(0, 10);

  const { data: jobs = [] } = useQuery({
    queryKey: ["schedule", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("jobs")
        .select("id, job_number, scheduled_date, window_start, window_end, problem_summary, priority, acknowledged_at, clients(name), sites(name, address), assets(reference_number, asset_category)")
        .eq("assigned_technician_id", profile.id)
        .gte("scheduled_date", today)
        .order("scheduled_date")
        .order("window_start");
      if (error) throw error;
      const ids = (data ?? []).map((j) => j.id);
      const { data: sheets } = ids.length ? await supabase.from("job_sheets").select("id, job_id, status, jobsheet_number").in("job_id", ids) : { data: [] };
      return (data as Job[]).map((j) => ({ ...j, sheet: (sheets ?? []).find((s) => s.job_id === j.id) ?? null }));
    },
  });

  /** Starting a job counts as acknowledging it — no separate step for routine work. */
  const autoAck = (j: Job) => {
    if (isPreview || j.acknowledged_at) return;
    void supabase.from("jobs").update({ acknowledged_at: new Date().toISOString() }).eq("id", j.id).then(({ error }) => {
      if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["schedule"] });
    });
  };

  const Actions = ({ j }: { j: Job }) => (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="h-10" onClick={() => setDetail(j)}>Details</Button>
      {j.sheet && j.sheet.status !== "draft" ? <Button asChild className="h-10" variant={j.sheet.status === "completed" ? "outline" : "default"}><Link to="/sheets/$sheetId" params={{ sheetId: j.sheet.id }}><FileText className="mr-1 h-4 w-4" />Open sheet{j.sheet.jobsheet_number ? ` #${j.sheet.jobsheet_number}` : ""}</Link></Button> : profile?.role === "technician" || profile?.role === "supervisor" ? <JobTravelActions profile={profile} jobId={j.id} address={j.sites?.address} readOnly={isPreview} /> : isPreview ? <Button disabled className="h-10"><FileText className="mr-1 h-4 w-4" />Start job</Button> : <Button asChild className="h-10"><Link to="/sheets/new" search={{ jobId: j.id }} onClick={() => autoAck(j)}><FileText className="mr-1 h-4 w-4" />Start job</Link></Button>}
    </div>
  );

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const iso = (d: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <AppShell
      title="Scheduled works"
      actions={
        <div className="flex rounded-md border">
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} onClick={() => setView("list")} aria-label="List view"><List className="h-4 w-4" /></Button>
          <Button size="sm" variant={view === "calendar" ? "secondary" : "ghost"} onClick={() => setView("calendar")} aria-label="Calendar view"><CalendarDays className="h-4 w-4" /></Button>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl">
        {view === "list" ? (
          jobs.length === 0 ? <EmptyState>No upcoming assignments.</EmptyState> : (
            <ul className="grid gap-3 md:grid-cols-2">
              {jobs.map((j) => (
                <li key={j.id} className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{new Date(j.scheduled_date + "T00:00").toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · {timeWindow(j.window_start, j.window_end)}</p>
                      <p className="truncate font-medium text-foreground">{j.clients?.name}{j.sites ? ` · ${j.sites.name}` : ""}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1"><PriorityBadge p={j.priority} /><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${schedStatus(j)[1]}`}>{schedStatus(j)[0]}</span></div>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{j.problem_summary || "No summary"}</p>
                  <Actions j={j} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <section className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium text-foreground">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="py-1 text-center text-muted-foreground">{d}</div>)}
              {Array.from({ length: offset }).map((_, i) => <div key={"o" + i} />)}
              {Array.from({ length: days }).map((_, i) => {
                const list = jobs.filter((j) => j.scheduled_date === iso(i + 1));
                return (
                  <div key={i} className={`min-h-16 rounded-md border p-1 sm:min-h-24 ${iso(i + 1) === today ? "border-primary" : ""}`}>
                    <p className="text-[11px] text-foreground">{i + 1}</p>
                    {list.map((j) => (
                      <button key={j.id} onClick={() => setDetail(j)} className={`mt-0.5 block w-full truncate rounded px-1 text-left text-[10px] ${schedStatus(j)[1]}`}>
                        {j.window_start?.slice(0, 5)} {j.clients?.name}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader><DialogTitle>Job #{detail.job_number} · {detail.clients?.name}</DialogTitle></DialogHeader>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">When</dt><dd>{new Date(detail.scheduled_date + "T00:00").toLocaleDateString()} · {timeWindow(detail.window_start, detail.window_end)}</dd>
                <dt className="text-muted-foreground">Site</dt><dd>{detail.sites ? `${detail.sites.name}${detail.sites.address ? `, ${detail.sites.address}` : ""}` : "—"}</dd>
                <dt className="text-muted-foreground">Lift</dt><dd>{detail.assets ? `${detail.assets.reference_number} · ${detail.assets.asset_category}` : "—"}</dd>
                <dt className="text-muted-foreground">Priority</dt><dd><PriorityBadge p={detail.priority} /></dd>
                <dt className="text-muted-foreground">Problem</dt><dd>{detail.problem_summary || "—"}</dd>
              </dl>
              <Actions j={detail} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
