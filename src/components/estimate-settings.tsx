import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { RFQ_FIELDS, SUPPLIER_CATEGORIES, parseEstimateConfig, type EstimateConfig } from "@/lib/lift-rfq";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuggestionChips } from "@/components/suggestion-chips";

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
/** Guidance and one-tap suggestions per supplier package category. */
const SUPPLIER_GUIDE: Record<string, { hint: string; suggestions: string[] }> = {
  doors: { hint: "Door types this supplier can provide.", suggestions: ["Automatic centre opening", "Automatic side opening", "Telescopic", "Semi-automatic swing", "Fire-rated (EI 60)", "Glass panel"] },
  machines: { hint: "Drives or machines they offer.", suggestions: ["Gearless MRL", "Geared traction", "Hydraulic direct", "Hydraulic indirect", "Platform lift drive"] },
  controllers: { hint: "Controller types or brands they supply.", suggestions: ["Microprocessor VVVF", "Hydraulic controller", "Duplex / group", "Destination control"] },
  fixtures: { hint: "Push buttons, displays and finishes.", suggestions: ["Stainless steel COP", "Glass COP", "Braille push buttons", "TFT display", "Dot-matrix display", "Voice announcer"] },
};

export function useEstimateConfig(companyId?: string) {
  return useQuery({ queryKey: ["estimate-config", companyId], enabled: !!companyId, queryFn: async () => { const r = await supabase.from("company_settings").select("estimate_config").eq("company_id", companyId!).single(); if (r.error) throw r.error; return parseEstimateConfig(r.data.estimate_config); } });
}

/** Company Settings → Estimates & suppliers. */
export function EstimateSettings({ companyId }: { companyId: string }) {
  const qc = useQueryClient(); const q = useEstimateConfig(companyId);
  const [draft, setDraft] = useState<EstimateConfig | null>(null); const [field, setField] = useState(RFQ_FIELDS.find((f) => f.type === "select")!.key); const [busy, setBusy] = useState(false);
  const v = draft ?? q.data; if (!v) return <p>{q.error?.message ?? "Loading…"}</p>;
  const set = (n: Partial<EstimateConfig>) => setDraft({ ...v, ...n });
  const f = RFQ_FIELDS.find((x) => x.key === field)!;
  const save = async () => { setBusy(true); const r = await supabase.from("company_settings").update({ estimate_config: v as unknown as Json }).eq("company_id", companyId); setBusy(false); if (r.error) { toast.error(r.error.message); return; } setDraft(null); qc.invalidateQueries({ queryKey: ["estimate-config"] }); toast.success("Estimate settings saved"); };
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-medium">Package suppliers</h2>
        <p className="text-sm text-muted-foreground">For complete lift packages, list what each supplier offers. When a supervisor picks that supplier, the estimate drop-downs only show these options. Leave a list empty to allow every option.</p>
        {v.suppliers.map((s, i) => { const up = (n: Partial<typeof s>) => set({ suppliers: v.suppliers.map((x, j) => (j === i ? { ...x, ...n } : x)) }); return (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <Input placeholder="Supplier name" value={s.name} onChange={(e) => up({ name: e.target.value })} />
              <Input type="email" placeholder="Estimate desk email" value={s.email} onChange={(e) => up({ email: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={s.package} onCheckedChange={(c) => up({ package: !!c })} />Complete packages</label>
              <Button size="icon" variant="ghost" aria-label="Remove supplier" onClick={() => set({ suppliers: v.suppliers.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
            {s.package && <div className="grid gap-3 sm:grid-cols-2">{SUPPLIER_CATEGORIES.map((c) => { const cur = (s.options[c.key] ?? []).join(", "); return <div key={c.key} className="space-y-1"><Label className="text-xs">{c.label}</Label><p className="text-xs text-muted-foreground">{SUPPLIER_GUIDE[c.key].hint}</p><Input key={`${i}-${c.key}-${cur}`} placeholder={`e.g. ${SUPPLIER_GUIDE[c.key].suggestions.slice(0, 2).join(", ")}`} defaultValue={cur} onBlur={(e) => up({ options: { ...s.options, [c.key]: list(e.target.value) } })} /><SuggestionChips value={cur} suggestions={SUPPLIER_GUIDE[c.key].suggestions} onChange={(next) => up({ options: { ...s.options, [c.key]: list(next) } })} /></div>; })}</div>}
          </div>); })}
        <Button variant="outline" size="sm" onClick={() => set({ suppliers: [...v.suppliers, { name: "", email: "", package: true, options: {} }] })}><Plus className="mr-1 h-4 w-4" />Add supplier</Button>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Drop-down choices & defaults</h2>
        <Select value={field} onValueChange={setField}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RFQ_FIELDS.filter((x) => x.type === "select").map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent></Select>
        <Label className="text-xs">Choices (comma separated — empty uses the standard list)</Label>
        <Input key={`o-${field}-${(v.options[field] ?? []).join("|")}`} placeholder={(f.options ?? []).join(", ")} defaultValue={(v.options[field] ?? []).join(", ")} onBlur={(e) => set({ options: { ...v.options, [field]: list(e.target.value) } })} />
        <SuggestionChips value={(v.options[field] ?? []).join(", ")} suggestions={[...(f.options ?? [])]} onChange={(next) => set({ options: { ...v.options, [field]: list(next) } })} />
        <Label className="text-xs">Company default</Label>
        <Input key={`d-${field}`} placeholder="e.g. 400V 3-phase 50Hz" defaultValue={v.defaults[field] ?? ""} onBlur={(e) => set({ defaults: { ...v.defaults, [field]: e.target.value.trim() } })} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Supplier reminders</h2>
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-xs">First after (days)</Label><Input type="number" min={1} value={v.reminders.first_days} onChange={(e) => set({ reminders: { ...v.reminders, first_days: Number(e.target.value) } })} /></div>
          <div><Label className="text-xs">Then every (days)</Label><Input type="number" min={1} value={v.reminders.every_days} onChange={(e) => set({ reminders: { ...v.reminders, every_days: Number(e.target.value) } })} /></div>
          <div><Label className="text-xs">Max reminders</Label><Input type="number" min={0} value={v.reminders.max} onChange={(e) => set({ reminders: { ...v.reminders, max: Number(e.target.value) } })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Reminders stop when the supplier's estimate is marked received. After the maximum, the estimate shows "Needs a phone call".</p>
      </section>
      <Button disabled={busy} onClick={save}>Save estimate settings</Button>
    </div>
  );
}
