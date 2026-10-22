import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { usePlanFeatures } from "@/lib/plan-features";
import { useProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/available-jobs")({
  head: () => ({ meta: [
    { title: "Available jobs — FieldBridgeApp" },
    { name: "description", content: "Open jobs that match your skills. The first technician to claim gets the place." },
    { property: "og:title", content: "Available jobs — FieldBridgeApp" },
    { property: "og:description", content: "Claim open jobs that match your skills." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AvailableJobs,
});

function AvailableJobs() {
  const { data: p } = useProfile();
  const feature = usePlanFeatures(!!p);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const jobs = useQuery({ queryKey: ["open-jobs"], refetchInterval: 30_000, queryFn: async () => { const r = await supabase.rpc("open_jobs_for_me"); if (r.error) throw r.error; return r.data ?? []; } });
  if (!feature("skills_dispatch")) return <AppShell title="Available jobs"><EmptyState title="Not included in your plan" hint="Open job claiming is part of Skills & Smart Dispatch." /></AppShell>;
  const claim = async (id: string) => {
    setBusy(id);
    const r = await supabase.rpc("claim_open_job", { _job: id });
    setBusy(null);
    if (r.error) toast.error(r.error.message); else toast.success(r.data === "lead" ? "Job claimed — you are the lead" : "You joined the crew");
    qc.invalidateQueries({ queryKey: ["open-jobs"] }); qc.invalidateQueries({ queryKey: ["today-jobs"] }); qc.invalidateQueries({ queryKey: ["schedule"] });
  };
  return (
    <AppShell title="Available jobs">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Jobs open to the team that match your skills. You must be clocked in to claim.</p>
        {jobs.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !(jobs.data ?? []).length ? <EmptyState title="No open jobs right now" hint="New open jobs appear here automatically." /> : (jobs.data ?? []).map(j => (
          <div key={j.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-medium">#{j.job_number} · {j.client_name ?? "Client"}{j.site_name ? ` · ${j.site_name}` : ""}</p>
                <p className="text-sm text-muted-foreground">{j.scheduled_date}{j.window_start ? ` · ${j.window_start.slice(0, 5)}` : ""}{j.window_end ? `–${j.window_end.slice(0, 5)}` : ""} · <span className="capitalize">{j.priority}</span></p></div>
              <span className="rounded-md border bg-muted px-2 py-1 text-sm">{j.places_left} of {j.required_team_size} places left</span>
            </div>
            {j.problem_summary && <p className="mt-2 text-sm">{j.problem_summary}</p>}
            {!!j.skills?.length && <div className="mt-2 flex flex-wrap gap-1">{j.skills.map(s => <span key={s} className="rounded-full border px-2 py-0.5 text-xs">{s}</span>)}</div>}
            <Button className="mt-3 h-11 w-full sm:w-auto" disabled={busy !== null} onClick={() => claim(j.id)}>{busy === j.id ? "Claiming…" : "Claim job"}</Button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
