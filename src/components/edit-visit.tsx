import { dispatchAvailability } from "@/lib/dispatch-availability";
import { incentiveCents } from "@/lib/claim-incentive";
import { notifyOpenJob } from "@/lib/web-push.functions";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyUsers, useProfile } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { groupSkills, skillMatchScore } from "@/lib/skills";
import { RECORD_DELETE_REFRESH_KEYS } from "@/lib/record-deletion";
import { isDispatchable, useFieldDispatchIds } from "@/lib/member-capabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Visit = { id: string; job_number: number; scheduled_date?: string | null };
type Draft = { scheduled_date: string; window_start: string; window_end: string; priority: string; problem_summary: string; tech: string; assistant: string; teamSize: number; open: boolean; tbd: boolean; hold: boolean; skills: string[] };

/** Edits an existing dispatched visit: date, time window, priority, instructions, lead/assistant and (with Smart Dispatch) skills, team size and open-to-claim. */
export function EditVisit({ visit }: { visit: Visit }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const feature = usePlanFeatures(!!profile);
  const smart = feature("skills_dispatch");
  const { data: users = [] } = useCompanyUsers();
  const { data: fieldIds } = useFieldDispatchIds();
  const staff = users.filter(u => isDispatchable(u.role, u.registration_status === "active", !!fieldIds?.has(u.id)));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bonus,setBonus]=useState('0.00');
  const [d, setD] = useState<Draft | null>(null);
  const { data: skillList = [] } = useQuery({ queryKey: ["company-skills"], enabled: smart && open, queryFn: async () => (await supabase.from("company_skills").select("id,name,category,archived").order("name")).data ?? [] });
  const { data: memberSkills = [] } = useQuery({ queryKey: ["member-skills"], enabled: smart && open, queryFn: async () => (await supabase.from("member_skills").select("user_id,skill_id")).data ?? [] });
  const skillsOf = (u: string) => memberSkills.filter(m => m.user_id === u).map(m => m.skill_id);
  const load = async () => {
    setOpen(true); setD(null);
    const [{ data, error }, { data: js }] = await Promise.all([
      supabase.from("jobs").select("scheduled_date, window_start, window_end, priority, problem_summary, assigned_technician_id, secondary_technician_id, required_team_size, open_to_claim, claim_hold, claim_incentive_cents").eq("id", visit.id).maybeSingle(),
      smart ? supabase.from("job_skills").select("skill_id").eq("job_id", visit.id) : Promise.resolve({ data: [] as { skill_id: string }[] }),
    ]);
    if (error || !data) { toast.error("Visit could not be loaded."); setOpen(false); return; }
    setBonus((data.claim_incentive_cents/100).toFixed(2));
    setD({ scheduled_date: data.scheduled_date ?? "", tbd: !data.scheduled_date, hold: data.claim_hold, window_start: data.window_start?.slice(0, 5) ?? "", window_end: data.window_end?.slice(0, 5) ?? "", priority: data.priority, problem_summary: data.problem_summary ?? "", tech: data.assigned_technician_id ?? "none", assistant: data.secondary_technician_id ?? "none", teamSize: data.required_team_size ?? 1, open: data.open_to_claim ?? false, skills: (js ?? []).map(x => x.skill_id) });
  };
  const set = (patch: Partial<Draft>) => setD(v => v ? { ...v, ...patch } : v);
  const save = async () => {
    if (!d || busy || !profile) return;
    const cents=incentiveCents(bonus);if(cents===null){toast.error('Enter a valid euro bonus with up to two decimals');return;}
    if (!d.tbd && !d.scheduled_date) { toast.error("Choose a date"); return; }
    if (d.assistant !== "none" && (d.tech === "none" || d.assistant === d.tech)) { toast.error("Choose a lead and a different assistant"); return; }
    if (d.window_start && d.window_end && d.window_end <= d.window_start) { toast.error("End time must be after start time"); return; }
    const named = [d.tech, d.assistant].filter(x => x !== "none").length;
    if (smart && d.open && named >= d.teamSize) { toast.error("All places are already assigned — nothing left to claim"); return; }
    setBusy(true);
    try {
      const availability = dispatchAvailability(d.tbd ? null : d.scheduled_date, d.tech, smart, d.hold, d.open && named < d.teamSize);
      const { error } = await supabase.from("jobs").update({ ...availability, window_start: d.window_start || null, window_end: d.window_end || null, priority: d.priority, problem_summary: d.problem_summary.trim() || null, assigned_technician_id: d.tech === "none" ? null : d.tech, secondary_technician_id: d.assistant === "none" ? null : d.assistant, ...(smart ? { required_team_size: d.teamSize, open_to_claim: availability.open_to_claim } : {}) } as never).eq("id", visit.id);
      if (error) { toast.error(error.message); return; }
      const bonusSave=await supabase.from('jobs').update({claim_incentive_cents:cents}).eq('id',visit.id);
      if(bonusSave.error){toast.error(bonusSave.error.message);return;}
      if (smart) {
        const del = await supabase.from("job_skills").delete().eq("job_id", visit.id);
        if (del.error) { toast.error(del.error.message); return; }
        if (d.skills.length) {
          const ins = await supabase.from("job_skills").insert(d.skills.map(skill_id => ({ job_id: visit.id, skill_id, company_id: profile.company_id, mandatory: true })));
          if (ins.error) { toast.error(ins.error.message); return; }
        }
      }
      if (availability.open_to_claim) void notifyOpenJob({data:{jobId:visit.id}}).catch(() => toast.warning("Job saved; phone alert could not be sent"));
      await Promise.all([...RECORD_DELETE_REFRESH_KEYS, "dispatched-visits", "schedule", "open-jobs"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(`Visit #${visit.job_number} updated`);
      setOpen(false);
    } finally { setBusy(false); }
  };
  const person = (value: string, onChange: (v: string) => void, label: string) => <div className="space-y-1"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{staff.map(u => <SelectItem key={u.id} value={u.id}>{smart && d?.skills.length ? `${u.full_name} · ${skillMatchScore(skillsOf(u.id), d.skills)}/${d.skills.length} skills` : u.full_name}</SelectItem>)}</SelectContent></Select></div>;
  return <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
    <Button size={visit.scheduled_date === null ? "sm" : "icon"} variant={visit.scheduled_date === null ? "outline" : "ghost"} className="shrink-0" title="Edit dispatched visit" aria-label={visit.scheduled_date === null ? `Schedule visit ${visit.job_number}` : `Edit visit ${visit.job_number}`} onClick={load}><Pencil className="h-4 w-4" />{visit.scheduled_date === null && "Schedule visit"}</Button>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit visit #{visit.job_number}</DialogTitle></DialogHeader>
      {!d ? <p className="text-sm text-muted-foreground">Loading…</p> : <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={d.tbd} onCheckedChange={v=>set({tbd:v===true})}/>Date to be decided (TBD)</label>
        {smart && d.tech === "none" && !d.tbd && <label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={d.hold} onCheckedChange={v=>set({hold:v===true})}/>Hold off Up for grabs</label>}
        <div className="space-y-1"><Label htmlFor="ev-date">Date</Label><Input id="ev-date" type="date" disabled={d.tbd} value={d.tbd ? "" : d.scheduled_date} onChange={e => set({ scheduled_date: e.target.value })} /></div>
        <div className="space-y-1"><Label>Priority</Label><Select value={d.priority} onValueChange={v => set({ priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["low", "normal", "high", "urgent"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="ev-from">From</Label><Input id="ev-from" type="time" disabled={d.tbd} value={d.window_start} onChange={e => set({ window_start: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="ev-to">To</Label><Input id="ev-to" type="time" disabled={d.tbd} value={d.window_end} onChange={e => set({ window_end: e.target.value })} /></div>
        {person(d.tech, v => set({ tech: v, assistant: v === "none" ? "none" : d.assistant }), "Lead")}
        {person(d.assistant, v => set({ assistant: v }), "Assistant")}
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="ev-sum">Instructions</Label><Textarea id="ev-sum" maxLength={2000} value={d.problem_summary} onChange={e => set({ problem_summary: e.target.value })} /></div>
        {smart&&<div className="space-y-1"><Label htmlFor="edit-claim-bonus">Claim bonus (€)</Label><Input id="edit-claim-bonus" type="number" min="0" step="0.01" value={bonus} onChange={e=>setBonus(e.target.value)}/></div>}
        {smart && <fieldset className="space-y-3 rounded-lg border p-3 sm:col-span-2">
          <legend className="px-1 text-sm font-medium">Skills & Smart Dispatch</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="ev-team">Team size</Label><Input id="ev-team" type="number" min={1} max={10} value={d.teamSize} onChange={e => set({ teamSize: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><Checkbox checked={d.open} onCheckedChange={v => set({ open: v === true })} />Open to claim by eligible clocked-in technicians</label>
          </div>
          {groupSkills(skillList.filter(s => !s.archived)).map(([name, skills]) => <div key={name} className="space-y-2"><p className="text-xs font-medium text-muted-foreground">{name}</p><div className="grid gap-2 sm:grid-cols-2">{skills.map(s => <label key={s.id} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"><Checkbox className="rounded-full" checked={d.skills.includes(s.id)} onCheckedChange={checked => set({ skills: checked === true ? [...new Set([...d.skills, s.id])] : d.skills.filter(id => id !== s.id) })} /><span>{s.name}</span></label>)}</div></div>)}
          {!skillList.filter(s => !s.archived).length && <p className="text-sm text-muted-foreground">No company skills yet — add them under Team → Skills.</p>}
        </fieldset>}
      </div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !d} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
