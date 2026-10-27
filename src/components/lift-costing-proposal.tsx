import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { NumInput } from "@/components/num-input";
import { QuotePhotoEditor, QuotePhotoGallery } from "@/components/customer-quote-photos";
import { EQUIPMENT_TYPES, OUTPUT_STYLES, SPEC_GROUPS, equipmentLabel, proposalSummary, specRows, stageAmounts, type CostingDraft, type OutputStyle } from "@/lib/lift-costing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const euro = (n: number) => `€${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type SetFn = (p: Partial<CostingDraft>) => void;

/** Tier-aware: company branding on the proposal only when the tenant's tier/pack includes document branding. */
export function useDocumentBranding() {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["module-access", profile?.company_id, "branding_documents"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const [access, company] = await Promise.all([
        supabase.rpc("company_module_access", { _company: profile!.company_id, _module: "branding_documents" }),
        supabase.from("companies").select("name").eq("id", profile!.company_id).maybeSingle(),
      ]);
      return { branded: access.data === true, name: company.data?.name ?? "" };
    },
    staleTime: 60_000,
  });
}

export function EquipmentAndLayout({ d, set }: { d: CostingDraft; set: SetFn }) {
  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Equipment & client price layout</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Equipment type</Label>
          <Select value={d.equipment_type} onValueChange={(v) => set({ equipment_type: v, ...(d.template_id ? {} : { spec_groups: EQUIPMENT_TYPES.find((e) => e.value === v)?.groups ?? [] }) })}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{EQUIPMENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Client price layout</Label>
          <Select value={d.output_style} onValueChange={(v) => set({ output_style: v as OutputStyle })}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{OUTPUT_STYLES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">VAT %</Label><NumInput className="h-10" min={0} max={100} step="0.5" value={d.vat_pct} onChange={(v) => set({ vat_pct: v })} /></div>
      </div>
      <p className="text-xs text-muted-foreground">{OUTPUT_STYLES.find((o) => o.value === d.output_style)?.hint}</p>
      {d.output_style === "turnkey" && (
        <div className="space-y-1"><Label className="text-xs">Single-line description shown to client</Label><Input className="h-10" placeholder="Supply, delivery, installation and commissioning of…" value={d.turnkey_description} onChange={(e) => set({ turnkey_description: e.target.value })} /></div>
      )}
    </fieldset>
  );
}

export function TechnicalSpecs({ d, set }: { d: CostingDraft; set: SetFn }) {
  const [custom, setCustom] = useState("");
  const toggle = (k: string) => set({ spec_groups: d.spec_groups.includes(k) ? d.spec_groups.filter((x) => x !== k) : [...d.spec_groups, k] });
  const val = (k: string, v: string) => set({ specs: { ...d.specs, [k]: v } });
  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Technical specification (shown to client)</legend>
      <div className="flex flex-wrap gap-2">
        {SPEC_GROUPS.map((g) => <Button key={g.key} type="button" size="sm" variant={d.spec_groups.includes(g.key) ? "default" : "outline"} onClick={() => toggle(g.key)}>{g.label}</Button>)}
      </div>
      <p className="text-xs text-muted-foreground">Switch on any group for any equipment — e.g. a 5-storey 4-post lift can still carry shaft, pit and headroom. Empty fields are left off the proposal.</p>
      {SPEC_GROUPS.filter((g) => d.spec_groups.includes(g.key)).map((g) => (
        <div key={g.key} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
          <div className="grid gap-2 sm:grid-cols-3">{g.fields.map((f) => <div key={f.key} className="space-y-1"><Label className="text-xs">{f.label}</Label><Input className="h-10" value={d.specs[f.key] ?? ""} onChange={(e) => val(f.key, e.target.value)} /></div>)}</div>
        </div>
      ))}
      {d.custom_specs.length > 0 && <div className="grid gap-2 sm:grid-cols-3">{d.custom_specs.map((c) => (
        <div key={c} className="space-y-1"><Label className="flex items-center justify-between text-xs">{c}<button type="button" aria-label={`Remove ${c}`} onClick={() => set({ custom_specs: d.custom_specs.filter((x) => x !== c) })}><X className="h-3 w-3" /></button></Label><Input className="h-10" value={d.specs[`custom:${c}`] ?? ""} onChange={(e) => val(`custom:${c}`, e.target.value)} /></div>
      ))}</div>}
      <div className="flex gap-2"><Input className="h-10" placeholder="Add your own spec field (e.g. Turntable diameter)" value={custom} onChange={(e) => setCustom(e.target.value)} /><Button type="button" variant="outline" disabled={!custom.trim() || d.custom_specs.includes(custom.trim())} onClick={() => { set({ custom_specs: [...d.custom_specs, custom.trim()] }); setCustom(""); }}><Plus className="h-4 w-4" /></Button></div>
    </fieldset>
  );
}

function BulletList({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2"><Input className="h-10" value={it} onChange={(e) => onChange(items.map((x, xi) => (xi === i ? e.target.value : x)))} /><Button type="button" size="icon" variant="ghost" aria-label="Remove line" onClick={() => onChange(items.filter((_, xi) => xi !== i))}><Trash2 className="h-4 w-4" /></Button></div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, ""])}><Plus className="mr-1 h-4 w-4" />{placeholder}</Button>
    </div>
  );
}

export function ProposalContent({ d, set }: { d: CostingDraft; set: SetFn }) {
  return (
    <fieldset className="space-y-4 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Proposal content</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <BulletList label="Included in scope" items={d.inclusions} onChange={(v) => set({ inclusions: v })} placeholder="Add included item" />
        <BulletList label="Exclusions & client responsibilities" items={d.exclusions} onChange={(v) => set({ exclusions: v })} placeholder="Add exclusion" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Options (client price, excl. VAT) — tick to include in the total</Label>
        {d.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Checkbox aria-label="Include option" checked={o.selected} onCheckedChange={(c) => set({ options: d.options.map((x, xi) => (xi === i ? { ...x, selected: c === true } : x)) })} />
            <Input className="h-10 flex-1" placeholder="e.g. Glass cabin wall" value={o.label} onChange={(e) => set({ options: d.options.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)) })} />
            <NumInput className="h-10 w-32" min={0} step="0.01" value={o.amount} onChange={(v) => set({ options: d.options.map((x, xi) => (xi === i ? { ...x, amount: v } : x)) })} />
            <Button type="button" size="icon" variant="ghost" aria-label="Remove option" onClick={() => set({ options: d.options.filter((_, xi) => xi !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => set({ options: [...d.options, { label: "", amount: 0, selected: false }] })}><Plus className="mr-1 h-4 w-4" />Add option</Button>
      </div>
      <div className="space-y-1"><Label className="text-xs">Special notes (lead time, validity, freight conditions…)</Label><Textarea rows={3} value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
      <QuotePhotoEditor quoteId={d.id} photos={d.photos} disabled={false} onChange={(photos) => set({ photos })} />
    </fieldset>
  );
}

export function ProposalPreview({ d }: { d: CostingDraft }) {
  const { data: brand } = useDocumentBranding();
  const s = proposalSummary(d);
  const specs = specRows(d);
  const stages = stageAmounts(s.grandNet, d.stages);
  const branded = brand?.branded === true;
  const heading = branded ? "text-primary" : "text-foreground";
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 text-sm">
      <div className={`flex items-center justify-between border-b pb-2 ${branded ? "border-primary" : ""}`}>
        <p className={`font-semibold ${heading}`}>{branded ? brand?.name || "Your company" : "Proposal"}</p>
        <span className="text-xs text-muted-foreground">{branded ? "Company branding" : "Standard layout — branding not in your plan"}</span>
      </div>
      <p className={`text-base font-semibold ${heading}`}>{d.title.trim() || equipmentLabel(d.equipment_type)}</p>
      {specs.length > 0 && <table className="w-full"><tbody>{specs.map((r) => <tr key={r.label} className="border-b last:border-0"><td className="py-1 pr-2 text-muted-foreground">{r.label}</td><td className="py-1">{r.value}</td></tr>)}</tbody></table>}
      <QuotePhotoGallery photos={d.photos} access={{ quoteId: d.id, photoIds: d.photos.map((p) => p.id) }} />
      {d.inclusions.some((x) => x.trim()) && <div><p className={`font-medium ${heading}`}>Included</p><ul className="list-disc pl-5">{d.inclusions.filter((x) => x.trim()).map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      {d.exclusions.some((x) => x.trim()) && <div><p className={`font-medium ${heading}`}>Exclusions & client responsibilities</p><ul className="list-disc pl-5">{d.exclusions.filter((x) => x.trim()).map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <div className="space-y-1 border-t pt-2">
        {d.output_style === "net_vat_shipping" ? (<>
          <Row l="Lift net price" v={s.net} /><Row l={`VAT ${d.vat_pct}%`} v={s.vat} /><Row l="Total lift price" v={s.total} bold />
          {s.shippingNet > 0 && <Row l="Shipping inc. VAT (estimate, varies monthly)" v={s.shippingIncVat} />}
          {s.lines.filter((l) => l.kind === "option").map((l, i) => <Row key={i} l={l.description} v={l.amount * (1 + d.vat_pct / 100)} />)}
          <Row l="Grand total inc. VAT" v={s.grandTotal} bold />
        </>) : (<>
          {s.lines.map((l, i) => <Row key={i} l={l.description} v={l.amount} />)}
          <Row l="Net total" v={s.grandNet} bold /><Row l={`VAT ${d.vat_pct}%`} v={s.grandVat} /><Row l="Grand total inc. VAT" v={s.grandTotal} bold />
        </>)}
      </div>
      {d.options.some((o) => !o.selected && o.label.trim()) && <div><p className={`font-medium ${heading}`}>Available options</p><ul className="list-disc pl-5">{d.options.filter((o) => !o.selected && o.label.trim()).map((o, i) => <li key={i}>{o.label} — {euro(o.amount)} + VAT</li>)}</ul></div>}
      {stages.length > 0 && <div><p className={`font-medium ${heading}`}>Payment stages</p>{stages.map((st, i) => <Row key={i} l={`${st.label} (${st.pct}%)`} v={st.amount} />)}</div>}
      {d.notes.trim() && <p className="whitespace-pre-wrap text-muted-foreground">{d.notes}</p>}
    </div>
  );
}
function Row({ l, v, bold }: { l: string; v: number; bold?: boolean }) {
  return <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}><span>{l}</span><span>{euro(v)}</span></div>;
}
