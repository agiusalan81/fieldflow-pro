import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/profile";
import { roundTo15 } from "@/lib/jobsheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const INTERNAL_ACTIVITIES = ["Helping installers", "Workshop / bench repairs", "Stores & parts run", "Vehicle maintenance", "Training / toolbox talk", "Office work", "Other"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Personal standard / 1.5× / 2× hours from filed daily works reports. */
export function OvertimeCard({ userId }: { userId: string }) {
  const [range, setRange] = useState<"week" | "month">("week");
  const now = new Date();
  const from = range === "week" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)) : new Date(now.getFullYear(), now.getMonth(), 1);
  const { data = [] } = useQuery({
    queryKey: ["dwr", "mine", userId, iso(from)],
    queryFn: async () => (await supabase.from("daily_work_reports").select("standard_hours, ot15_hours, ot20_hours").eq("user_id", userId).gte("report_date", iso(from))).data ?? [],
  });
  const sum = (k: "standard_hours" | "ot15_hours" | "ot20_hours") => data.reduce((s, r) => s + Number(r[k]), 0).toFixed(2);
  return (
    <section className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Clock className="h-4 w-4 text-primary" />My hours</p>
        <div className="flex rounded-md border text-xs">
          {(["week", "month"] as const).map((r) => <button key={r} type="button" onClick={() => setRange(r)} className={`px-2 py-1 ${range === r ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>{r === "week" ? "This week" : "This month"}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {([["Standard 1.0×", "standard_hours"], ["Overtime 1.5×", "ot15_hours"], ["Overtime 2.0×", "ot20_hours"]] as const).map(([l, k]) => (
          <div key={k} className="rounded-lg bg-muted/50 p-2"><p className="font-display text-xl tabular-nums text-foreground">{sum(k)}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Worked out automatically from your shifts and job sheets each time you clock out.</p>
    </section>
  );
}

/** Hours on work that has no client job sheet (e.g. helping installers), so the day stays accounted for. */
export function InternalWorkCard({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const today = iso(new Date());
  const { data: logs = [] } = useQuery({
    queryKey: ["internal-work", profile.id, today],
    queryFn: async () => (await supabase.from("internal_work_logs").select("*").eq("user_id", profile.id).eq("log_date", today).order("time_in")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const blank = { activity: INTERNAL_ACTIVITIES[0]!, other: "", location: "", time_in: "", time_out: "", notes: "" };
  const [f, setF] = useState(blank);
  const save = async () => {
    const activity = f.activity === "Other" ? f.other.trim() : f.activity;
    if (!activity) { toast.error("Say what the work was"); return; }
    if (!f.time_in || !f.time_out || f.time_out <= f.time_in) { toast.error("Time out must be after time in"); return; }
    const { error } = await supabase.from("internal_work_logs").insert({ company_id: profile.company_id, user_id: profile.id, log_date: today, activity: activity.slice(0, 120), location: f.location.trim().slice(0, 200) || null, time_in: f.time_in, time_out: f.time_out, notes: f.notes.trim().slice(0, 1000) || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Work logged — it will appear on today's daily works report");
    setOpen(false); setF(blank);
    qc.invalidateQueries({ queryKey: ["internal-work", profile.id] });
  };
  const remove = async (id: string) => { await supabase.from("internal_work_logs").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["internal-work", profile.id] }); };
  return (
    <section className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Wrench className="h-4 w-4 text-primary" />Other work today (no job sheet)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Log work</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log other work</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>What did you do?</Label>
                <Select value={f.activity} onValueChange={(v) => setF({ ...f, activity: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERNAL_ACTIVITIES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
                {f.activity === "Other" && <Input className="h-11" placeholder="Describe the work" value={f.other} onChange={(e) => setF({ ...f, other: e.target.value })} />}
              </div>
              <div className="space-y-1.5"><Label>Where</Label><Input className="h-11" placeholder="e.g. Installation at Sliema Tower" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Time in</Label><Input className="h-11" type="time" step={900} value={f.time_in} onChange={(e) => setF({ ...f, time_in: e.target.value })} onBlur={(e) => e.target.value && setF({ ...f, time_in: roundTo15(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Time out</Label><Input className="h-11" type="time" step={900} value={f.time_out} onChange={(e) => setF({ ...f, time_out: e.target.value })} onBlur={(e) => e.target.value && setF({ ...f, time_out: roundTo15(e.target.value) })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
              <Button className="h-11 w-full" onClick={save}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {logs.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              <span className="tabular-nums text-muted-foreground">{l.time_in.slice(0, 5)}–{l.time_out.slice(0, 5)}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{l.activity}{l.location ? ` · ${l.location}` : ""}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove" onClick={() => remove(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
