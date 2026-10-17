import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, CheckCircle2, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers } from "@/lib/profile";
import { parsePhotos } from "@/lib/jobsheets";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pending-works")({
  head: () => ({
    meta: [
      { title: "Pending works — FieldOps" },
      { name: "description", content: "Follow-up repairs flagged by technicians, ready to schedule or quote." },
      { property: "og:title", content: "Pending works — FieldOps" },
      { property: "og:description", content: "Follow-up repairs ready to schedule or quote." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendingWorks,
});

const STATUS: Record<string, string> = { open: "Open", quote: "Awaiting quote", scheduled: "Scheduled", done: "Done" };

export function usePendingWorks() {
  return useQuery({
    queryKey: ["pending-works"],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_sheets")
        .select("id, jobsheet_number, client_id, site_id, asset_id, pending_works_future_jobs, pending_status, photo_paths, updated_at, clients(name), sites(name), assets(reference_number), users(full_name)")
        .not("pending_works_future_jobs", "is", null).neq("pending_works_future_jobs", "").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function PendingWorks() {
  const { data: profile } = useProfile();
  const { data = [] } = usePendingWorks();
  const { data: users = [] } = useCompanyUsers();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("active");
  const [sched, setSched] = useState<(typeof data)[number] | null>(null);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), tech: "none" });
  const rows = data.filter((r) => filter === "all" || (filter === "active" ? r.pending_status !== "done" : r.pending_status === filter));
  const setStatus = async (id: string, s: string) => {
    const { error } = await supabase.from("job_sheets").update({ pending_status: s }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["pending-works"] });
  };
  const schedule = async () => {
    if (!sched || !profile) return;
    const { data: job, error } = await supabase.from("jobs").insert({
      company_id: profile.company_id, client_id: sched.client_id, site_id: sched.site_id, asset_id: sched.asset_id,
      assigned_technician_id: f.tech === "none" ? null : f.tech, scheduled_date: f.date,
      problem_summary: `Follow-up from #${sched.jobsheet_number}: ${sched.pending_works_future_jobs}`.slice(0, 500), priority: "normal",
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("job_sheets").update({ pending_status: "scheduled", pending_job_id: job.id }).eq("id", sched.id);
    toast.success("Return visit scheduled");
    setSched(null);
    qc.invalidateQueries({ queryKey: ["pending-works"] });
  };
  return (
    <AppShell title="Pending works">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {["active", "open", "quote", "scheduled", "done", "all"].map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>{s === "active" ? "Not done" : s === "all" ? "All" : STATUS[s]}</Button>
          ))}
        </div>
        {!rows.length ? <EmptyState>No pending works here.</EmptyState> : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const photos = parsePhotos(r.photo_paths).filter((p) => p.scope === "pending").length;
              return (
                <li key={r.id} className="cursor-pointer rounded-xl border bg-card p-4" onClick={() => navigate({ to: "/sheets/$sheetId", params: { sheetId: r.id } })}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">#{r.jobsheet_number} · {r.users?.full_name ?? "—"} · {new Date(r.updated_at).toLocaleDateString()}{photos ? ` · ${photos} photo${photos > 1 ? "s" : ""}` : ""}</p>
                      <p className="truncate font-medium text-foreground">{r.clients?.name}{r.sites?.name ? ` · ${r.sites.name}` : ""}{r.assets?.reference_number ? ` · ${r.assets.reference_number}` : ""}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{STATUS[r.pending_status] ?? r.pending_status}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground">{r.pending_works_future_jobs}</p>
                  <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {r.pending_status !== "scheduled" && r.pending_status !== "done" && <Button size="sm" onClick={() => setSched(r)}><CalendarPlus className="mr-1 h-4 w-4" />Schedule visit</Button>}
                    {r.pending_status === "open" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "quote")}><Receipt className="mr-1 h-4 w-4" />Needs quote</Button>}
                    {r.pending_status !== "done" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "done")}><CheckCircle2 className="mr-1 h-4 w-4" />Mark done</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Dialog open={!!sched} onOpenChange={(o) => !o && setSched(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule return visit</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{sched?.clients?.name} · {sched?.pending_works_future_jobs}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Date</Label><Input className="h-11" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Technician</Label>
              <Select value={f.tech} onValueChange={(v) => setF({ ...f, tech: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Unassigned</SelectItem>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <Button className="h-11" onClick={schedule}>Create job</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
