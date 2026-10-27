import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INSPECTION_TYPES, inspectionStatus, inspectionTypeLabel } from "@/lib/lift-inspections";

const blank = { inspection_type: "periodic", inspection_body: "", inspector_name: "", certificate_no: "", inspected_on: new Date().toISOString().slice(0, 10), next_due: "", result: "pass", defects: "", notes: "" };
const RESULT: Record<string, string> = { pass: "Pass", pass_with_defects: "Pass with defects", fail: "Fail" };
const STATUS: Record<string, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "border-destructive bg-destructive/10 text-destructive" },
  due_soon: { label: "Due within 30 days", cls: "border-primary bg-primary/10 text-primary" },
  ok: { label: "In date", cls: "text-muted-foreground" },
  unscheduled: { label: "No next date", cls: "text-muted-foreground" },
};

/** Tenant-only statutory inspections register for one lift or escalator. */
export function LiftInspections({ assetId, canManage }: { assetId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["lift-inspections", assetId], queryFn: async () => { const r = await supabase.from("lift_inspections").select("*").eq("asset_id", assetId).order("inspected_on", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  const refresh = () => qc.invalidateQueries({ queryKey: ["lift-inspections", assetId] });
  const save = async () => {
    if (!form) return; setBusy(true);
    const r = await supabase.from("lift_inspections").insert({ ...form, asset_id: assetId, next_due: form.next_due || null });
    setBusy(false); if (r.error) { toast.error(r.error.message); return; }
    toast.success("Inspection recorded"); setForm(null); void refresh();
  };
  const latest = data[0];
  const status = inspectionStatus(latest?.next_due);
  return <section className="space-y-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-semibold">Statutory inspections</h2>{latest && <p className="text-sm text-muted-foreground">Next due {latest.next_due ?? "—"} <span className={`ml-1 rounded-full border px-2 py-0.5 text-xs ${STATUS[status]!.cls}`}>{STATUS[status]!.label}</span></p>}</div>
      {canManage && <Button size="sm" onClick={() => setForm({ ...blank })}><Plus className="mr-1 h-4 w-4" />Record inspection</Button>}
    </div>
    {data.length === 0 && <p className="text-sm text-muted-foreground">No inspections recorded yet.</p>}
    <div className="divide-y">{data.map((i) => <div key={i.id} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1"><p className="font-medium">{inspectionTypeLabel(i.inspection_type)} · {i.inspected_on} · {RESULT[i.result] ?? i.result}</p>
        <p className="text-xs text-muted-foreground">{[i.inspection_body, i.inspector_name, i.certificate_no && `Cert ${i.certificate_no}`, i.next_due && `Next due ${i.next_due}`].filter(Boolean).join(" · ")}</p>
        {i.defects && <p className="mt-1 whitespace-pre-wrap text-xs">Defects: {i.defects}</p>}</div>
      {i.defects && <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={i.defects_closed} disabled={!canManage} onCheckedChange={async (v) => { const r = await supabase.from("lift_inspections").update({ defects_closed: v === true }).eq("id", i.id); if (r.error) toast.error(r.error.message); else void refresh(); }} />Defects closed</label>}
      {canManage && <Button size="icon" variant="ghost" aria-label="Delete inspection" onClick={async () => { if (!window.confirm("Delete this inspection record?")) return; const r = await supabase.from("lift_inspections").delete().eq("id", i.id); if (r.error) toast.error(r.error.message); else void refresh(); }}><Trash2 className="h-4 w-4" /></Button>}
    </div>)}</div>
    <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Record statutory inspection</DialogTitle></DialogHeader>{form && <div className="grid gap-3 sm:grid-cols-2">
      <div><Label>Type</Label><Select value={form.inspection_type} onValueChange={(v) => setForm({ ...form, inspection_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INSPECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{inspectionTypeLabel(t)}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Result</Label><Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RESULT).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Inspection body</Label><Input value={form.inspection_body} onChange={(e) => setForm({ ...form, inspection_body: e.target.value })} /></div>
      <div><Label>Inspector</Label><Input value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} /></div>
      <div><Label>Certificate no.</Label><Input value={form.certificate_no} onChange={(e) => setForm({ ...form, certificate_no: e.target.value })} /></div>
      <div><Label>Inspected on</Label><Input type="date" value={form.inspected_on} onChange={(e) => setForm({ ...form, inspected_on: e.target.value })} /></div>
      <div><Label>Next due</Label><Input type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} /></div>
      <div className="sm:col-span-2"><Label>Defects found</Label><Textarea rows={3} value={form.defects} onChange={(e) => setForm({ ...form, defects: e.target.value })} /></div>
      <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button disabled={busy || !form.inspected_on} onClick={() => void save()}>Save</Button></div>
    </div>}</DialogContent></Dialog>
  </section>;
}
