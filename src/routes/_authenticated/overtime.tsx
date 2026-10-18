import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/overtime")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Overtime & standby — FieldOps" },
      { name: "description", content: "Log weekend, after-hours and standby call-outs with travel and work hours." },
      { property: "og:title", content: "Overtime & standby — FieldOps" },
      { property: "og:description", content: "Log call-outs and travel hours." },
    ],
  }),
  component: OvertimePage,
});

const TYPES = { weekend: "Weekend call-out", after_hours: "After-hours call-out", standby: "Standby", public_holiday: "Public holiday" } as const;

function OvertimePage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState({ log_date: new Date().toISOString().slice(0, 10), call_type: "after_hours", travel_hours: "", work_hours: "", job_sheet_id: "none", notes: "" });

  const { data: logs = [] } = useQuery({
    queryKey: ["overtime"],
    queryFn: async () => {
      const { data, error } = await supabase.from("overtime_logs").select("*, users(full_name)").order("log_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["ot-jobs", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase.from("job_sheets").select("id, clients(name), created_at").eq("assigned_technician_id", profile!.id).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase.from("overtime_logs").insert({
      company_id: profile.company_id, user_id: profile.id, log_date: form.log_date, call_type: form.call_type,
      travel_hours: Number(form.travel_hours || 0), work_hours: Number(form.work_hours || 0),
      job_sheet_id: form.job_sheet_id === "none" ? null : form.job_sheet_id, notes: form.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Overtime logged");
    setForm({ ...form, travel_hours: "", work_hours: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["overtime"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("overtime_logs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["overtime"] });
  };

  const total = logs.reduce((s, l) => s + Number(l.travel_hours) + Number(l.work_hours), 0);

  return (
    <AppShell title="Overtime & standby">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-medium text-foreground">Log a call-out</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Date</Label><Input className="h-11" type="date" required value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.call_type} onValueChange={(v) => setForm({ ...form, call_type: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Travel hours</Label><Input className="h-11" type="number" step="0.25" min="0" inputMode="decimal" value={form.travel_hours} onChange={(e) => setForm({ ...form, travel_hours: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Work hours</Label><Input className="h-11" type="number" step="0.25" min="0" inputMode="decimal" value={form.work_hours} onChange={(e) => setForm({ ...form, work_hours: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Related job (optional)</Label>
            <Select value={form.job_sheet_id} onValueChange={(v) => setForm({ ...form, job_sheet_id: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.clients?.name} · {new Date(j.created_at).toLocaleDateString()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button type="submit" className="h-11 w-full">Save log</Button>
        </form>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-foreground">{isManager(profile) ? "All logs" : "My logs"}</h2>
            <span className="text-sm text-muted-foreground">{total.toFixed(2)} h total</span>
          </div>
          {logs.length === 0 ? <EmptyState>Nothing logged yet.</EmptyState> : (
            <ul className="space-y-2">
              {logs.map((l) => (
                <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{TYPES[l.call_type as keyof typeof TYPES]} · {new Date(l.log_date).toLocaleDateString()}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {isManager(profile) && `${l.users?.full_name} · `}Travel {Number(l.travel_hours)}h · Work {Number(l.work_hours)}h{l.notes ? ` · ${l.notes}` : ""}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
