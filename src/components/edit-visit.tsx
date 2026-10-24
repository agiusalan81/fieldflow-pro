import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyUsers } from "@/lib/profile";
import { RECORD_DELETE_REFRESH_KEYS } from "@/lib/record-deletion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Visit = { id: string; job_number: number };
type Draft = { scheduled_date: string; window_start: string; window_end: string; priority: string; problem_summary: string; tech: string; assistant: string };
const FIELD = ["technician", "supervisor", "maintenance"];

/** Edits an existing dispatched visit: date, time window, priority, instructions and lead/assistant. */
export function EditVisit({ visit }: { visit: Visit }) {
  const qc = useQueryClient();
  const { data: users = [] } = useCompanyUsers();
  const staff = users.filter(u => FIELD.includes(u.role) && u.registration_status === "active");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Draft | null>(null);
  const load = async () => {
    setOpen(true); setD(null);
    const { data, error } = await supabase.from("jobs").select("scheduled_date, window_start, window_end, priority, problem_summary, assigned_technician_id, secondary_technician_id").eq("id", visit.id).maybeSingle();
    if (error || !data) { toast.error("Visit could not be loaded."); setOpen(false); return; }
    setD({ scheduled_date: data.scheduled_date, window_start: data.window_start?.slice(0, 5) ?? "", window_end: data.window_end?.slice(0, 5) ?? "", priority: data.priority, problem_summary: data.problem_summary ?? "", tech: data.assigned_technician_id ?? "none", assistant: data.secondary_technician_id ?? "none" });
  };
  const set = (patch: Partial<Draft>) => setD(v => v ? { ...v, ...patch } : v);
  const save = async () => {
    if (!d || busy) return;
    if (!d.scheduled_date) { toast.error("Choose a date"); return; }
    if (d.assistant !== "none" && (d.tech === "none" || d.assistant === d.tech)) { toast.error("Choose a lead and a different assistant"); return; }
    if (d.window_start && d.window_end && d.window_end <= d.window_start) { toast.error("End time must be after start time"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("jobs").update({ scheduled_date: d.scheduled_date, window_start: d.window_start || null, window_end: d.window_end || null, priority: d.priority, problem_summary: d.problem_summary.trim() || null, assigned_technician_id: d.tech === "none" ? null : d.tech, secondary_technician_id: d.assistant === "none" ? null : d.assistant } as never).eq("id", visit.id);
      if (error) { toast.error(error.message); return; }
      await Promise.all([...RECORD_DELETE_REFRESH_KEYS, "dispatched-visits", "schedule"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(`Visit #${visit.job_number} updated`);
      setOpen(false);
    } finally { setBusy(false); }
  };
  const person = (value: string, onChange: (v: string) => void, label: string) => <div className="space-y-1"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{staff.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent></Select></div>;
  return <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
    <Button size="icon" variant="ghost" className="shrink-0" title="Edit dispatched visit" aria-label={`Edit visit ${visit.job_number}`} onClick={load}><Pencil className="h-4 w-4" /></Button>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit visit #{visit.job_number}</DialogTitle></DialogHeader>
      {!d ? <p className="text-sm text-muted-foreground">Loading…</p> : <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="ev-date">Date</Label><Input id="ev-date" type="date" value={d.scheduled_date} onChange={e => set({ scheduled_date: e.target.value })} /></div>
        <div className="space-y-1"><Label>Priority</Label><Select value={d.priority} onValueChange={v => set({ priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["low", "normal", "high", "urgent"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="ev-from">From</Label><Input id="ev-from" type="time" value={d.window_start} onChange={e => set({ window_start: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="ev-to">To</Label><Input id="ev-to" type="time" value={d.window_end} onChange={e => set({ window_end: e.target.value })} /></div>
        {person(d.tech, v => set({ tech: v, assistant: v === "none" ? "none" : d.assistant }), "Lead")}
        {person(d.assistant, v => set({ assistant: v }), "Assistant")}
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="ev-sum">Instructions</Label><Textarea id="ev-sum" maxLength={2000} value={d.problem_summary} onChange={e => set({ problem_summary: e.target.value })} /></div>
      </div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !d} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
