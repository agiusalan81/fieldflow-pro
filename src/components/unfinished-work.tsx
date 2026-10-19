import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/profile";
import { nextDay, unfinishedJobs } from "@/lib/field-rules";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Job = { id: string; job_number: number | null; problem_summary: string | null; clients: { name: string } | null };
type Choice = { action: "" | "tomorrow" | "standby" | "dispatch"; reason: string; standby: string };
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Before clock-out: every unfinished job assigned today must be rolled over, handed to standby or returned to dispatch. */
export function UnfinishedWorkDialog({ profile, onCancel, onDone }: { profile: Profile; onCancel: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [standby, setStandby] = useState<{ id: string; full_name: string }[]>([]);
  const [pick, setPick] = useState<Record<string, Choice>>({});
  const [busy, setBusy] = useState(false);
  const today = localToday();
  useEffect(() => {
    void (async () => {
      const { data: js } = await supabase.from("jobs").select("id, job_number, problem_summary, clients(name)").eq("assigned_technician_id", profile.id).eq("scheduled_date", today);
      const list = (js ?? []) as Job[];
      const { data: sheets } = list.length ? await supabase.from("job_sheets").select("job_id, status").in("job_id", list.map((j) => j.id)) : { data: [] };
      const open = unfinishedJobs(list, sheets ?? []);
      if (!open.length) { onDone(); return; }
      setJobs(open);
      const { data: people } = await supabase.from("users").select("id, full_name").neq("id", profile.id);
      const on = await Promise.all((people ?? []).map(async (u) => ((await supabase.rpc("is_on_standby", { _user: u.id, _date: today })).data ? u : null)));
      setStandby(on.filter((u): u is { id: string; full_name: string } => !!u));
    })();
  }, [profile.id, today, onDone]);
  if (!jobs) return null;
  const c = (id: string): Choice => pick[id] ?? { action: "", reason: "", standby: "" };
  const set = (id: string, p: Partial<Choice>) => setPick({ ...pick, [id]: { ...c(id), ...p } });
  const ready = jobs.every((j) => { const x = c(j.id); return x.action && x.reason.trim() && (x.action !== "standby" || x.standby); });
  const submit = async () => {
    setBusy(true);
    try {
      for (const j of jobs) {
        const x = c(j.id);
        const note = `${new Date().toLocaleString()} · ${profile.full_name}: ${x.reason.trim()}`;
        const patch = x.action === "tomorrow" ? { scheduled_date: nextDay(today) } : x.action === "standby" ? { assigned_technician_id: x.standby } : { assigned_technician_id: null };
        const { error } = await supabase.from("jobs").update({ ...patch, handover_action: x.action === "tomorrow" ? "rolled_over" : x.action === "standby" ? "handed_to_standby" : "returned_to_dispatch", handover_note: note, handover_at: new Date().toISOString(), acknowledged_at: null }).eq("id", j.id);
        if (error) throw error;
      }
      toast.success("Unfinished work handed over");
      qc.invalidateQueries({ queryKey: ["today-jobs"] });
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Unfinished work today</DialogTitle><DialogDescription>Before you clock out, choose what happens to each job you didn't finish. Hours already on a job sheet are kept.</DialogDescription></DialogHeader>
        <ul className="space-y-3">
          {jobs.map((j) => { const x = c(j.id); return (
            <li key={j.id} className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">{j.clients?.name ?? "Job"}{j.job_number ? ` · #${j.job_number}` : ""}</p>
              {j.problem_summary && <p className="text-xs text-muted-foreground">{j.problem_summary}</p>}
              <div className="grid grid-cols-3 gap-1.5">
                {([["tomorrow", "Move to tomorrow"], ["standby", "Hand to standby"], ["dispatch", "Return to dispatch"]] as const).map(([k, l]) => (
                  <Button key={k} type="button" size="sm" variant={x.action === k ? "default" : "outline"} className="h-auto min-h-9 whitespace-normal px-2 text-xs" disabled={k === "standby" && !standby.length} onClick={() => set(j.id, { action: k })}>{l}</Button>
                ))}
              </div>
              {x.action === "standby" && <select aria-label="Standby technician" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={x.standby} onChange={(e) => set(j.id, { standby: e.target.value })}><option value="">Choose standby technician…</option>{standby.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select>}
              {x.action && <Input className="h-10" placeholder="Reason (e.g. waiting for parts, no access)" value={x.reason} onChange={(e) => set(j.id, { reason: e.target.value })} />}
            </li>); })}
        </ul>
        {!standby.length && <p className="text-xs text-muted-foreground">Nobody is on standby tonight.</p>}
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={onCancel}>Back</Button><Button disabled={!ready || busy} onClick={submit}>Hand over & clock out</Button></div>
      </DialogContent>
    </Dialog>
  );
}
