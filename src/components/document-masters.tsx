import { usePlanFeatures } from "@/lib/plan-features";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Copy, Eye, Archive, Plus, Trash2, Paperclip, Pencil, Download, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { A4Document } from "@/components/a4-document";
import { AUDIENCES, TECH_CHECK_OPTIONS, parseAudience, parseSections, sectionsFor, toggleAudience, type Audience, type DocSection } from "@/lib/document-audience";
import { BILLING_CYCLES, DEFAULT_LIFT_PRICING, audienceCopyRows, stepPrice, specChoices, checklistRows, extrasFor, hasCommercial, summaryItemsFromText, summaryItemsToText, type SummaryItem, parseCommercial, parseExtras, parseFieldSpecs, specShows, type BlockAudience, type Commercial, type Extra, type FieldSpec } from "@/lib/document-blocks";
import { ChecklistRowEditor } from "@/components/checklist-row-editor";
import { RichText } from "@/components/rich-text";
import { useCompanyRules } from "@/lib/company";
import { companyHasLiftTrade, isLiftTrade } from "@/lib/trade-association";
import { CompanyTradeSelect } from "@/components/company-trade-select";
import { buildMasterDocumentPdf } from "@/lib/master-document-pdf";
import { CommercialPriceSummary, LiftCommercialEditor } from "@/components/lift-commercial";
import { Link } from "@tanstack/react-router";
import { CONTRACT_TYPE_PRESETS, DOC_TYPE_PRESETS, SECTORS, copyAudience, defaultCopyView, docTypeLabel, fitsAttachment, learnedOptions, missingTags, normalizeDocType, sectorLabel } from "@/lib/document-library-tags";
import { SearchSelect } from "@/components/search-select";
import { FormatToolbar } from "@/components/format-toolbar";
import { extractDocumentText } from "@/lib/document-library.functions";
import { libraryTermText } from "@/lib/customer-quote-extras";
import { parseTerms, termsFor } from "@/lib/documents";
import { stripRich } from "@/lib/rich-text";
import type { TierValue } from "@/lib/document-blocks";

type TierOpt = { id: string; name: string; visits_per_year: number | null; annual_price: number | null; labour_discount_pct: number | null; parts_discount_pct: number | null };

/** Toggles a tier on a draft: keeps tier_id as the first selection, syncs per-tier commercial values and auto-fills empty single-tier fields. */
function applyTierToggle<T extends { tier_id: string | null; tier_ids?: string[]; commercial: unknown }>(doc: T, tier: TierOpt, on: boolean): T {
  const current = doc.tier_ids ?? (doc.tier_id ? [doc.tier_id] : []);
  const next = on ? [...new Set([...current, tier.id])] : current.filter((id) => id !== tier.id);
  const c = parseCommercial(doc.commercial);
  let tierValues = c.tierValues.filter((v) => next.includes(v.tierId));
  if (on && !tierValues.some((v) => v.tierId === tier.id)) tierValues = [...tierValues, { tierId: tier.id, name: tier.name, visitsPerYear: tier.visits_per_year ?? null, basePrice: tier.annual_price ?? null, labourDiscountPct: tier.labour_discount_pct ?? 0, partsDiscountPct: tier.parts_discount_pct ?? 0 }];
  let commercial: Commercial = { ...c, tierValues };
  if (next.length === 1) {
    const v = tierValues.find((x) => x.tierId === next[0]);
    if (v) commercial = { ...commercial, visitsPerYear: commercial.visitsPerYear ?? v.visitsPerYear, basePrice: commercial.basePrice ?? v.basePrice, labourDiscountPct: commercial.labourDiscountPct || v.labourDiscountPct, partsDiscountPct: commercial.partsDiscountPct || v.partsDiscountPct };
  }
  return { ...doc, tier_id: next[0] ?? null, tier_ids: next, commercial: commercial as unknown as Json };
}

type Master = Database["public"]["Tables"]["document_masters"]["Row"];
type PreviewDoc = Pick<Master, "name" | "body" | "items" | "kind"> & Partial<Pick<Master, "sections" | "revision" | "trade" | "field_specs" | "commercial" | "extras">>;

function PhotoSlot({ item }: { item: string }) {
  return <label className="mt-1 flex w-fit cursor-pointer items-center gap-1 rounded border border-dashed px-2 py-1 text-[11px] opacity-80"><Camera className="h-3 w-3" />Add photo<input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={`Photo for ${item}`} /></label>;
}

function ChecklistEntry({ item, spec, index }: { item: string; spec: FieldSpec; index: number }) {
  return <div>{<ChecklistControl item={item} spec={spec} index={index} />}{spec.photo && <PhotoSlot item={item} />}</div>;
}

function ChecklistControl({ item, spec, index }: { item: string; spec: FieldSpec; index: number }) {
  if (spec.control === "passfail") {
    return <fieldset className="flex items-center justify-between gap-3 border-b pb-1"><legend className="sr-only">{item}</legend><span className="flex-1">{index + 1}. <RichText text={item} /></span><span className="flex gap-3">{TECH_CHECK_OPTIONS.map((o) => <label key={o} className="flex items-center gap-1 text-[11px]"><input type="radio" name={`chk-${index}`} value={o} />{o}</label>)}</span></fieldset>;
  }
  if (spec.control === "choice") {
    return <fieldset className="flex items-center justify-between gap-3 border-b pb-1"><legend className="sr-only">{item}</legend><span className="flex-1">{index + 1}. <RichText text={item} /></span><span className="flex flex-wrap gap-3">{specChoices(spec).map((o) => <label key={o} className="flex items-center gap-1 text-[11px]"><input type="radio" name={`chk-${index}`} value={o} />{o}</label>)}</span></fieldset>;
  }
  if (spec.control === "reading") {
    return <div className="flex items-center justify-between gap-3 border-b pb-1"><span className="flex-1">{index + 1}. <RichText text={item} /></span><span className="flex items-center gap-1"><input aria-label={`${item} reading`} className="w-20 border-b bg-transparent text-right text-[12px] outline-none" placeholder="____" />{spec.unit && <span className="text-[11px] opacity-70">{spec.unit}</span>}</span></div>;
  }
  return <label className="flex items-center gap-2 border-b pb-1"><span className="flex-1">{index + 1}. <RichText text={item} /></span><input type="checkbox" aria-label={item} /></label>;
}

export function MasterPreview({ doc, initialView = "client" }: { doc: PreviewDoc; initialView?: Audience }) {
  const [view, setView] = useState<Audience>(initialView);
  const { data: company } = useCompanyRules();
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      const bytes = await buildMasterDocumentPdf(doc, view, company?.logo ? { logo: company.logo } : {});
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${doc.name.replace(/[\\/:*?"<>|]/g, "_")}-${view}.pdf`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not download document"); }
    finally { setDownloading(false); }
  };
  const tech = view === "technician";
  const sections = sectionsFor(parseSections(doc.sections), view);
  const rows = checklistRows(doc.items, doc.field_specs).filter(row => row.item.trim());
  const commercial = parseCommercial(doc.commercial);
  const showCommercial = !tech && commercial.showOnClient && hasCommercial(commercial);
  const extras = extrasFor(parseExtras(doc.extras), view);
  const blocks = [
    ...doc.body.split(/\n\s*\n/).filter((p) => p.trim()).map((p, i) => <p key={`b${i}`} className="whitespace-pre-wrap">{p}</p>),
    ...sections.map((s, i) => <section key={`s${i}`} className="space-y-1">{s.title && <h3 className="document-label text-xs font-semibold uppercase">{s.title}</h3>}<p className="whitespace-pre-wrap">{s.body}</p></section>),
    ...(doc.kind === "checklist" ? rows.flatMap(({ item, spec }, i) => {
      if (!specShows(spec, view)) return [];
      return [tech ? <ChecklistEntry key={`i${i}`} item={item} spec={spec} index={i} /> : <p key={`i${i}`} className="flex gap-3 pl-4 -indent-3"><span className="flex-1">• <RichText text={item} /></span>{stepPrice(spec) && <span className="tabular-nums">{stepPrice(spec)}</span>}</p>];
    }) : []),
    ...(tech ? [<section key="tech-notes" className="space-y-2"><h3 className="document-label text-xs font-semibold uppercase">Technician notes & observations</h3><textarea aria-label="Technician notes" rows={4} className="w-full rounded border bg-transparent p-2 text-[12px] outline-none" placeholder="Findings, parts replaced, advice…" /><label className="flex w-fit cursor-pointer items-center gap-1 rounded border border-dashed px-2 py-1 text-[11px]"><Camera className="h-3 w-3" />Upload photos<input type="file" multiple accept="image/*" capture="environment" className="sr-only" aria-label="Upload technician photos" /></label>{doc.kind === "checklist" && <p className="text-[11px] opacity-70">Unticked steps are reported as N/A.</p>}</section>] : []),
    ...(extras.length ? [<section key="extras" className="space-y-1"><h3 className="document-label text-xs font-semibold uppercase">Additional details</h3><dl className="space-y-1">{extras.map((e, i) => <div key={i} className="flex gap-2"><dt className="font-medium">{e.label}:</dt><dd className="whitespace-pre-wrap">{e.value}</dd></div>)}</dl></section>] : []),
    ...(showCommercial ? [<section key="comm" className="space-y-1 rounded border p-3"><h3 className="document-label text-xs font-semibold uppercase">Service summary</h3>
      {commercial.tierValues.length > 1 && <div className="space-y-1">{commercial.tierValues.map((t) => <p key={t.tierId}><span className="font-semibold">{t.name || "Tier"}:</span> {[t.visitsPerYear !== null ? `${t.visitsPerYear} visits / year` : "", t.basePrice !== null ? `€${t.basePrice.toFixed(2)}` : "", t.labourDiscountPct ? `${t.labourDiscountPct}% labour discount` : "", t.partsDiscountPct ? `${t.partsDiscountPct}% parts discount` : ""].filter(Boolean).join(" · ")}</p>)}</div>}
      {commercial.tierValues.length <= 1 && commercial.visitsPerYear !== null && <p>{commercial.visitsPerYear} visits per year</p>}
      {commercial.tierValues.length <= 1 && <CommercialPriceSummary value={commercial} cycle={BILLING_CYCLES.find((c) => c.key === commercial.billingCycle)?.label.toLowerCase()} />}
      {commercial.tierValues.length <= 1 && (commercial.labourDiscountPct > 0 || commercial.partsDiscountPct > 0) && <p>Discounts: {commercial.labourDiscountPct > 0 && `${commercial.labourDiscountPct}% labour`}{commercial.labourDiscountPct > 0 && commercial.partsDiscountPct > 0 && " · "}{commercial.partsDiscountPct > 0 && `${commercial.partsDiscountPct}% parts`}</p>}
      {commercial.summaryItems.length > 0 && <div className="space-y-1 pt-1"><ul className="space-y-1">{commercial.summaryItems.map((it, i) => <li key={i} className="flex items-start gap-2">{it.tag && <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ color: "var(--document-primary)", borderColor: "var(--document-primary)" }}>{it.tag}</span>}<span className="flex-1"><RichText text={it.text} /></span></li>)}</ul></div>}
      {commercial.terms.trim() && <p className="whitespace-pre-wrap text-[12px] opacity-80">{commercial.terms}</p>}
    </section>] : []),
  ];
  return <div className="min-w-0 space-y-3 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{doc.name}</h3>
      <div role="group" aria-label="Copy" className="flex flex-wrap gap-1">{AUDIENCES.map((a) => <Button key={a.key} size="sm" variant={view === a.key ? "default" : "outline"} onClick={() => setView(a.key)}>{a.key === "client" ? "Client copy" : "Technician copy"}</Button>)}<Button title="Download selected copy as PDF" aria-label="Download document PDF" size="icon" variant="outline" disabled={downloading} onClick={download}><Download className="h-4 w-4" /></Button></div></div>
    <A4Document title={doc.name} subtitle={[doc.trade, doc.revision && `Revision ${doc.revision}`, tech ? "Technician copy" : "Client copy"].filter(Boolean).join(" · ")} blocks={blocks.length ? blocks : [<p key="e" className="opacity-60">Nothing to show on this copy yet.</p>]} />
  </div>;
}

function SectionEditor({ sections, onChange }: { sections: DocSection[]; onChange: (s: DocSection[]) => void }) {
  const up = (i: number, n: Partial<DocSection>) => onChange(sections.map((s, j) => (j === i ? { ...s, ...n } : s)));
  return <div className="space-y-2"><Label>Sections</Label><p className="text-xs text-muted-foreground">Mark pricing, discounts and visit numbers as “Client copy only” so technicians never see them.</p>
    {sections.map((s, i) => <div key={i} className="space-y-2 rounded-lg border p-2">
      <div className="flex gap-2"><Input placeholder="Section title" value={s.title} onChange={(e) => up(i, { title: e.target.value })} /><Button size="icon" variant="ghost" aria-label="Remove section" onClick={() => onChange(sections.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>
      <Select value={s.audience} onValueChange={(v) => up(i, { audience: v as DocSection["audience"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Both copies</SelectItem><SelectItem value="client">Client copy only</SelectItem><SelectItem value="technician">Technician copy only</SelectItem></SelectContent></Select>
      <Textarea rows={4} value={s.body} onChange={(e) => up(i, { body: e.target.value })} />
    </div>)}
    <Button size="sm" variant="outline" onClick={() => onChange([...sections, { title: "", body: "", audience: "both" }])}><Plus className="mr-1 h-4 w-4" />Add section</Button></div>;
}

const AUDIENCE_OPTS: { key: BlockAudience; label: string }[] = [{ key: "both", label: "Both copies" }, { key: "technician", label: "Technician only" }, { key: "client", label: "Client only" }];

function CommercialEditor({ value, onChange, liftEnabled }: { value: Commercial; onChange: (c: Commercial) => void; liftEnabled: boolean }) {
  const extractTerms = useServerFn(extractDocumentText);
  const { data: library } = useQuery({ queryKey: ["doc-terms-library"], queryFn: async () => { const [masters, files, settings] = await Promise.all([supabase.from("document_masters").select("id,name,body,commercial").eq("kind", "terms").eq("state", "active").order("name"), supabase.from("company_documents").select("id,name").eq("category", "terms").order("name"), supabase.from("company_settings").select("terms").maybeSingle()]); return { masters: masters.data ?? [], files: files.data ?? [], preset: termsFor(parseTerms(settings.data?.terms), "agreement") }; } });
  const multi = value.tierValues.length > 1;
  const setTier = (tierId: string, patch: Partial<TierValue>) => onChange({ ...value, tierValues: value.tierValues.map((t) => (t.tierId === tierId ? { ...t, ...patch } : t)) });
  const pickTerms = (key: string) => { void (async () => { try {
    if (key === "preset") { onChange({ ...value, terms: library?.preset ?? "" }); return; }
    let text = "";
    if (key.startsWith("master:")) { const m = library?.masters.find((x) => x.id === key.slice(7)); if (m) text = libraryTermText(m); }
    else text = (await extractTerms({ data: { documentId: key.slice(5) } })).text;
    if (text.length > 5000) throw new Error("These terms exceed 5,000 characters. Shorten them in the library first.");
    onChange({ ...value, terms: text });
  } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load those terms"); } })(); };
  return <div className="space-y-3 rounded-lg border p-3"><div className="flex items-center justify-between"><Label>Document setup — pricing engine & service terms</Label><label className="flex items-center gap-2 text-xs">Show prices on client copy<Switch checked={value.showOnClient} onCheckedChange={(showOnClient) => onChange({ ...value, showOnClient })} /></label></div>
    <p className="text-xs text-muted-foreground">Optional. Leave price empty for a pure checklist document. Technicians never see this block.</p>
    <div className="grid grid-cols-2 gap-3">
      {!multi && <div><Label>Visits / year</Label><Input min={0} type="number" value={value.visitsPerYear ?? ""} onChange={(e) => onChange({ ...value, visitsPerYear: e.target.value === "" ? null : Number(e.target.value) })} /></div>}
      {!multi && <div><Label>Base price (€)</Label><Input min={0} step="0.01" type="number" value={value.basePrice ?? ""} onChange={(e) => onChange({ ...value, basePrice: e.target.value === "" ? null : Number(e.target.value) })} /></div>}
      <div><Label>Billing cycle</Label><Select value={value.billingCycle} onValueChange={(v) => onChange({ ...value, billingCycle: v as Commercial["billingCycle"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BILLING_CYCLES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent></Select></div>
      {!multi && <div className="grid grid-cols-2 gap-2"><div><Label>Labour disc %</Label><Input min={0} max={100} type="number" value={value.labourDiscountPct} onChange={(e) => onChange({ ...value, labourDiscountPct: Number(e.target.value) })} /></div><div><Label>Parts disc %</Label><Input min={0} max={100} type="number" value={value.partsDiscountPct} onChange={(e) => onChange({ ...value, partsDiscountPct: Number(e.target.value) })} /></div></div>}
    </div>
    {multi && <div className="space-y-2"><p className="text-xs text-muted-foreground">Each selected tier gets its own visits, price and discounts — the client copy shows them side by side for comparison.</p>{value.tierValues.map((t) => <div key={t.tierId} className="space-y-2 rounded-md border p-2"><p className="text-sm font-medium">{t.name || "Tier"}</p><div className="grid grid-cols-2 gap-2">
      <div><Label>Visits / year</Label><Input aria-label={`Visits per year for ${t.name}`} min={0} type="number" value={t.visitsPerYear ?? ""} onChange={(e) => setTier(t.tierId, { visitsPerYear: e.target.value === "" ? null : Number(e.target.value) })} /></div>
      <div><Label>Base price (€)</Label><Input aria-label={`Base price for ${t.name}`} min={0} step="0.01" type="number" value={t.basePrice ?? ""} onChange={(e) => setTier(t.tierId, { basePrice: e.target.value === "" ? null : Number(e.target.value) })} /></div>
      <div><Label>Labour disc %</Label><Input aria-label={`Labour discount for ${t.name}`} min={0} max={100} type="number" value={t.labourDiscountPct} onChange={(e) => setTier(t.tierId, { labourDiscountPct: Number(e.target.value) })} /></div>
      <div><Label>Parts disc %</Label><Input aria-label={`Parts discount for ${t.name}`} min={0} max={100} type="number" value={t.partsDiscountPct} onChange={(e) => setTier(t.tierId, { partsDiscountPct: Number(e.target.value) })} /></div>
    </div></div>)}</div>}
    {liftEnabled && <LiftCommercialEditor alwaysOn value={value.liftPricing ? value : { ...value, liftPricing: { ...DEFAULT_LIFT_PRICING } }} onChange={onChange} />}
    <SummaryItemsEditor items={value.summaryItems} onChange={(summaryItems) => onChange({ ...value, summaryItems })} />
    <div className="space-y-1.5"><Label>Terms</Label><SearchSelect value="" placeholder="Insert terms from library…" options={[...(library?.preset ? [{ value: "preset", label: "Company agreement terms" }] : []), ...(library?.masters ?? []).map((m) => ({ value: `master:${m.id}`, label: m.name })), ...(library?.files ?? []).map((f) => ({ value: `file:${f.id}`, label: `${f.name} (uploaded file)` }))]} onChange={pickTerms} /><Textarea rows={3} value={value.terms} onChange={(e) => onChange({ ...value, terms: e.target.value })} placeholder="Payment terms, response times, exclusions…" /></div></div>;
}

function SummaryItemsEditor({ items, onChange }: { items: SummaryItem[]; onChange: (items: SummaryItem[]) => void }) {
  const [text, setText] = useState(() => summaryItemsToText(items));
  const [focused, setFocused] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!focused) setText(summaryItemsToText(items)); }, [items, focused]);
  const up = (i: number, n: Partial<SummaryItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...n } : it)));
  const setBoth = (t: string) => { setText(t); onChange(summaryItemsFromText(t)); };
  return <div className="space-y-2"><Label>Summary items (client copy)</Label>
    <p className="text-xs text-muted-foreground">One item per line. Add a subtag with <code>[Included] Annual safety certification</code> or <code>24/7 callout :: Coverage</code>. Select text, then use the toolbar for bold or colour. Shown under Service summary in your brand colour; technicians never see these.</p>
    <FormatToolbar target={area} onText={setBoth} label="Summary item formatting" />
    <Textarea ref={area} aria-label="Summary items" rows={4} value={text} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(e) => setBoth(e.target.value)} placeholder={"[Included] Annual safety certification\n[Optional] Weekend callouts\nRemote monitoring :: SLA"} />
    {items.length > 0 && <div className="space-y-1">{items.map((it, i) => <div key={i} className="grid grid-cols-[110px_1fr_36px] gap-2">
      <Input aria-label={`Subtag ${i + 1}`} placeholder="Subtag" value={it.tag} onChange={(e) => up(i, { tag: e.target.value.slice(0, 40) })} />
      <div className="min-w-0"><Input aria-label={`Summary item ${i + 1}`} value={it.text} onChange={(e) => up(i, { text: e.target.value })} />{it.text.trim() && stripRich(it.text) !== it.text && <p className="mt-0.5 text-xs text-muted-foreground"><RichText text={it.text} /></p>}</div>
      <Button size="icon" variant="ghost" aria-label="Remove summary item" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
    </div>)}</div>}
  </div>;
}

function ExtrasEditor({ extras, onChange }: { extras: Extra[]; onChange: (e: Extra[]) => void }) {
  const up = (i: number, n: Partial<Extra>) => onChange(extras.map((e, j) => (j === i ? { ...e, ...n } : e)));
  return <div className="space-y-2"><Label>Trade-specific details</Label><p className="text-xs text-muted-foreground">Extra key/value fields per trade, e.g. “Response time: 4 hours” or “Oil grade: ISO 32”.</p>
    {extras.map((e, i) => <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1.4fr_140px_36px]">
      <Input placeholder="Label" value={e.label} onChange={(ev) => up(i, { label: ev.target.value })} />
      <Input placeholder="Value" value={e.value} onChange={(ev) => up(i, { value: ev.target.value })} />
      <Select value={e.audience} onValueChange={(v) => up(i, { audience: v as BlockAudience })}><SelectTrigger aria-label={`Visibility for ${e.label || "detail"}`}><SelectValue /></SelectTrigger><SelectContent>{AUDIENCE_OPTS.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}</SelectContent></Select>
      <Button size="icon" variant="ghost" aria-label="Remove detail" onClick={() => onChange(extras.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
    </div>)}
    <Button size="sm" variant="outline" onClick={() => onChange([...extras, { label: "", value: "", audience: "both" }])}><Plus className="mr-1 h-4 w-4" />Add detail</Button></div>;
}

export function AudienceToggles({ value, onChange, disabled }: { value: Audience[]; onChange: (a: Audience[]) => void; disabled?: boolean }) {
  return <div className="space-y-2"><Label>Who can see this document</Label><p className="text-xs text-muted-foreground">Office staff and supervisors always see it.</p>
    {AUDIENCES.map((a) => <label key={a.key} className="flex items-center justify-between text-sm">{a.label}<Switch disabled={disabled} checked={value.includes(a.key)} onCheckedChange={() => onChange(toggleAudience(value, a.key))} /></label>)}</div>;
}

export function DocumentMasters({ companyId, clientId, siteId, assetId }: { companyId: string; clientId?: string; siteId?: string; assetId?: string }) {
  const [picking, setPicking] = useState(false);
  const qc = useQueryClient();
  const { data: company } = useCompanyRules();
  const planOn = usePlanFeatures();
  const liftEnabled = companyHasLiftTrade(company?.industry, company?.trades) && planOn("lift_pack");
  const [edit, setEdit] = useState<Master | null>(null);
  const editLift = liftEnabled && (!edit?.trade || isLiftTrade(edit.trade));
  const [renaming, setRenaming] = useState<Master | null>(null);
  const [renameName, setRenameName] = useState("");
  const [filter, setFilter] = useState("all"); const [preview, setPreview] = useState<Master | null>(null); const [deleting, setDeleting] = useState<Master | null>(null); const [client, setClient] = useState(clientId ?? ""); const [audienceFilter, setAudienceFilter] = useState<"all" | "technician" | "client">("all"); const [site, setSite] = useState(siteId ?? ""); const [asset, setAsset] = useState(assetId ?? "");
  const { data: docs = [] } = useQuery({ queryKey: ["document-masters"], queryFn: async () => { const r = await supabase.from("document_masters").select("*").order("created_at", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  const { data: refs } = useQuery({ queryKey: ["master-usage"], queryFn: async () => { const [a, t, c] = await Promise.all([supabase.from("document_attachments").select("*, clients(name), sites(name), assets(reference_number, asset_category)"), supabase.from("contract_types").select("id,name,lifecycle,visits_per_year,annual_price,labour_discount_pct,parts_discount_pct,base_document_id,checklist_document_id,maintenance_agreements(clients(name))"), supabase.from("clients").select("id,name").order("name")]); if (a.error || t.error || c.error) throw a.error || t.error || c.error; return { attachments: a.data, tiers: t.data, clients: c.data }; } });
  const attachClient = clientId || client;
  const { data: siteAssets } = useQuery({ queryKey: ["attach-site-assets", attachClient], enabled: !!attachClient, queryFn: async () => { const [si, as] = await Promise.all([supabase.from("sites").select("id,name").eq("client_id", attachClient).order("name"), supabase.from("assets").select("id,site_id,reference_number,asset_category").eq("client_id", attachClient).order("reference_number")]); if (si.error || as.error) throw si.error || as.error; return { sites: si.data, assets: as.data }; } });
  const typeOptions = learnedOptions(DOC_TYPE_PRESETS, docs.map((d) => d.kind === "other" ? "reference" : d.kind));
  const contractTypeOptions = learnedOptions(CONTRACT_TYPE_PRESETS, docs.map((d) => d.contract_type));
  const tierOptions = (refs?.tiers ?? []).filter((t) => t.lifecycle !== "archived");
  const [newTier, setNewTier] = useState<{ name: string; visits: string; price: string; labour: string; parts: string } | null>(null);
  const saveNewTier = async () => {
    if (!newTier?.name.trim() || !edit) return;
    const r = await supabase.from("contract_types").insert({ company_id: companyId, name: newTier.name.trim(), tier: newTier.name.trim(), equipment_category: "", visits_per_year: Number(newTier.visits || 0), annual_price: Number(newTier.price || 0), labour_discount_pct: Number(newTier.labour || 0), parts_discount_pct: Number(newTier.parts || 0), lifecycle: "active" }).select("id,name,visits_per_year,annual_price,labour_discount_pct,parts_discount_pct").single();
    if (r.error) { toast.error(r.error.message); return; }
    toast.success("Tier created and selected");
    setEdit((cur) => cur ? applyTierToggle(cur, r.data, true) : cur);
    setNewTier(null);
    void qc.invalidateQueries({ queryKey: ["master-usage"] }); void qc.invalidateQueries({ queryKey: ["contract-tiers"] }); void qc.invalidateQueries({ queryKey: ["agreement-opts"] });
  };
  const tagError = (d: { kind: string; contract_type?: string | null; sector?: string | null }) => { const m = missingTags(d); if (m.length) toast.error(`Choose ${m.join(", ")} before saving`); return m.length > 0; };
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["document-masters"] }); void qc.invalidateQueries({ queryKey: ["master-usage"] }); };
  const act = async (action: () => PromiseLike<{ error: { message: string } | null }>, message: string) => { const r = await action(); if (r.error) { toast.error(r.error.message); return false; } toast.success(message); refresh(); return true; };
  const create = async () => { const r = await supabase.from("document_masters").insert({ company_id: companyId, name: "Untitled document" }).select("*").single(); if (r.error) toast.error(r.error.message); else { setEdit(r.data); refresh(); } };
  const clone = async (d: Master) => { const r = await supabase.from("document_masters").insert({ company_id: companyId, name: `${d.name} — copy`, kind: d.kind, trade: d.trade, body: d.body, items: d.items, sections: d.sections, audience: d.audience, cloned_from: d.id, revision: d.revision + 1, field_specs: d.field_specs, commercial: d.commercial, extras: d.extras, contract_type: d.contract_type, sector: d.sector, tier_id: d.tier_id, tier_ids: d.tier_ids }).select("*").single(); if (r.error) toast.error(r.error.message); else { setEdit(r.data); refresh(); } };
  const save = async (state = "draft") => {
    if (!edit) return;
    if (!edit.name.trim()) { toast.error("Enter a document name"); return; }
    if (state === "active" && tagError(edit)) return;
    const sections = parseSections(edit.sections).filter((s) => s.title.trim() || s.body.trim());
    const rows = checklistRows(edit.items, edit.field_specs).filter(row => row.item.trim());
    const items = rows.map(row => row.item.trim());
    const specs = rows.map(row => row.spec);
    const parsedCommercial = parseCommercial(edit.commercial);
    const commercial = editLift && !parsedCommercial.liftPricing ? { ...parsedCommercial, liftPricing: { ...DEFAULT_LIFT_PRICING } } : parsedCommercial;
    const extras = parseExtras(edit.extras);
    if (await act(() => supabase.from("document_masters").update({ name: edit.name.trim(), kind: edit.kind, trade: edit.trade, body: edit.body, items, sections: sections as unknown as Json, audience: parseAudience(edit.audience), state, field_specs: specs as unknown as Json, commercial: commercial as unknown as Json, extras: extras as unknown as Json, contract_type: edit.contract_type, sector: edit.sector, tier_id: edit.tier_id, tier_ids: edit.tier_ids }).eq("id", edit.id), state === "active" ? "Document published" : "Draft saved")) setEdit(null);
  };
  const saveCopy = async (view: "technician" | "client" | null, tier?: { id: string; name: string }) => {
    if (!edit) return;
    if (!edit.name.trim()) { toast.error("Enter a document name"); return; }
    if (tagError(edit)) return;
    const rows = view ? audienceCopyRows(edit.items, edit.field_specs, view) : { items: edit.items.filter(i => i.trim()), specs: checklistRows(edit.items, edit.field_specs).filter(r => r.item.trim()).map(r => r.spec) };
    const base = edit.name.trim() || "Untitled document";
    const name = view ? `${base} — ${view === "technician" ? "Technician copy" : "Client copy"}` : `${base} — ${tier?.name ?? "copy"}`;
    const sections = view ? parseSections(edit.sections).filter(s => s.audience === "both" || s.audience === view).map(s => ({ ...s, audience: view })) : parseSections(edit.sections);
    const extras = view ? extrasFor(parseExtras(edit.extras), view) : parseExtras(edit.extras);
    const commercial = view === "technician" ? null : edit.commercial;
    const r = await supabase.from("document_masters").insert({ company_id: companyId, name, kind: edit.kind, trade: edit.trade, body: edit.body, items: rows.items, field_specs: rows.specs as unknown as Json, sections: sections as unknown as Json, extras: extras as unknown as Json, ...(commercial ? { commercial } : {}), audience: view ? [view] : parseAudience(edit.audience), cloned_from: edit.id, contract_type: edit.contract_type, sector: edit.sector, tier_id: tier?.id ?? edit.tier_id, tier_ids: tier ? [tier.id] : edit.tier_ids, state: view ? "active" : "draft" }).select("id").single();
    if (r.error) { toast.error(r.error.message); return false; }
    toast.success(view ? `“${name}” saved to the library` : `Saved “${name}” as a new draft`); refresh(); return true;
  };
  const setAudience = async (d: Master, audience: Audience[]) => { await act(() => supabase.from("document_masters").update({ audience }).eq("id", d.id), "Visibility updated"); };
  const usageOf = (d: Master) => { const tiers = (refs?.tiers ?? []).filter((t) => t.base_document_id === d.id || t.checklist_document_id === d.id); const clients = [...(refs?.attachments ?? []).filter((a) => a.master_id === d.id).map((a) => a.clients?.name ?? "Client"), ...tiers.flatMap((t) => t.maintenance_agreements.map((a) => a.clients?.name ?? "Client"))]; return { clients: [...new Set(clients)].sort(), tiers: [...new Set(tiers.map((t) => t.name))] }; };
  const [confirmText, setConfirmText] = useState("");
  const counts = { all: docs.length, active: docs.filter((d) => d.state === "active").length, draft: docs.filter((d) => d.state === "draft").length, archived: docs.filter((d) => d.state === "archived").length } as Record<string, number>;
  const attach = async () => { if (!preview || !(clientId || client)) return; if (await act(() => supabase.from("document_attachments").insert({ company_id: companyId, client_id: clientId || client, master_id: preview.id, site_id: site || null, asset_id: asset || null }), "Document attached")) { setPreview(null); setSite(siteId ?? ""); setAsset(assetId ?? ""); } };
  const list = docs.filter((d) => (!clientId || d.state === "active") && (filter === "all" || d.state === filter) && (audienceFilter === "all" || copyAudience(d.audience) === audienceFilter || copyAudience(d.audience) === "both"));
  const editItems = edit?.items ?? [];
  const editSpecs = edit ? parseFieldSpecs(edit.field_specs, editItems.length) : [];
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Reusable documents</h2><div className="flex gap-2"><div role="tablist" aria-label="Document status" className="flex rounded-md border p-0.5">{(clientId ? ["all"] : ["all", "active", "draft", "archived"]).map((s) => <Button key={s} role="tab" aria-selected={filter === s} size="sm" variant={filter === s ? "secondary" : "ghost"} className="h-8 capitalize" onClick={() => setFilter(s)}>{s === "draft" ? "Drafts" : s} <span className="ml-1 text-xs text-muted-foreground">{counts[s]}</span></Button>)}</div>{!clientId && <Button onClick={create}><Plus className="mr-1 h-4 w-4" />Create new document</Button>}</div></div>
    <div role="tablist" aria-label="Copy audience" className="flex w-fit rounded-md border p-0.5">{([["all", "All copies"], ["technician", "Technician copies"], ["client", "Client copies"]] as const).map(([k, l]) => <Button key={k} role="tab" aria-selected={audienceFilter === k} size="sm" variant={audienceFilter === k ? "secondary" : "ghost"} className="h-8" onClick={() => setAudienceFilter(k)}>{l}</Button>)}</div>
    {list.length === 0 && <p className="py-6 text-sm text-muted-foreground">No documents in this view.</p>}
    <div className="divide-y border-y">{list.map((d) => <div key={d.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-medium">{d.name}{d.state === "archived" && <span className="ml-2 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">Archived</span>}</p><div className="mt-1 flex flex-wrap gap-1 text-[11px]">{(() => { const a = copyAudience(d.audience); return <span className={`rounded-full border px-2 py-0.5 font-semibold ${a === "technician" ? "border-primary bg-primary/10 text-primary" : a === "client" ? "border-accent-foreground/30 bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{a === "technician" ? "Technician copy" : a === "client" ? "Client copy" : "Both copies"}</span>; })()}<span className="rounded-full border px-2 py-0.5">{docTypeLabel(d.kind)}</span>{d.contract_type && <span className="rounded-full border px-2 py-0.5">{d.contract_type}</span>}{(d.tier_ids?.length ? d.tier_ids : d.tier_id ? [d.tier_id] : []).map((id) => <span key={id} className="rounded-full border px-2 py-0.5">{refs?.tiers.find((t) => t.id === id)?.name ?? "Tier"}</span>)}<span className="rounded-full border px-2 py-0.5">{sectorLabel(d.sector)}</span><span className="px-1 text-muted-foreground">{d.state} · Rev {d.revision}{d.trade && ` · ${d.trade}`}</span></div></div><Button title="Preview" aria-label={`Preview ${d.name}`} size="icon" variant="ghost" onClick={() => { setPreview(d); setClient(clientId ?? ""); }}><Eye className="h-4 w-4" /></Button>{!clientId && <><Button title="Rename" aria-label={`Rename ${d.name}`} size="icon" variant="ghost" onClick={() => { setRenaming(d); setRenameName(d.name); }}><Pencil className="h-4 w-4" /></Button><Button title="Clone" aria-label={`Clone ${d.name}`} size="icon" variant="ghost" onClick={() => clone(d)}><Copy className="h-4 w-4" /></Button>{d.state === "draft" && <Button size="sm" variant="outline" onClick={() => setEdit(d)}>Edit draft</Button>}{d.state === "active" && <Button title="Archive" aria-label={`Archive ${d.name}`} size="icon" variant="ghost" onClick={() => act(() => supabase.from("document_masters").update({ state: "archived" }).eq("id", d.id), "Document archived")}><Archive className="h-4 w-4" /></Button>}{d.state === "archived" && <Button size="sm" variant="outline" onClick={() => act(() => supabase.from("document_masters").update({ state: "active" }).eq("id", d.id), "Document restored")}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>}<Button title="Delete" aria-label={`Delete ${d.name}`} size="icon" variant="ghost" onClick={() => setDeleting(d)}><Trash2 className="h-4 w-4" /></Button></>}</div>)}</div>
    {clientId && <div className="space-y-2 rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Attached to this {assetId ? "equipment" : siteId ? "site" : "client"}</h3><div className="flex gap-2"><Button size="sm" onClick={() => setPicking(true)}><Plus className="mr-1 h-4 w-4" />Attach document</Button><Button size="sm" variant="outline" asChild><Link to="/contracts" search={{ tab: "masters" }}>Create new document</Link></Button></div></div>{(refs?.attachments ?? []).filter((a) => a.client_id === clientId && (!siteId || a.site_id === siteId || !a.site_id) && (!assetId || a.asset_id === assetId || !a.asset_id)).length === 0 && <p className="text-sm text-muted-foreground">No documents attached yet. Use “Attach document” to add a checklist, contract or terms.</p>}</div>}
    {clientId && <div className="space-y-2">{refs?.attachments.filter((a) => a.client_id === clientId && (!siteId || a.site_id === siteId || !a.site_id) && (!assetId || a.asset_id === assetId || !a.asset_id)).map((a) => <div key={a.id} className="flex items-center justify-between border p-3 text-sm"><span>{docs.find((d) => d.id === a.master_id)?.name ?? "Attached document"}<span className="block text-xs text-muted-foreground">{a.assets ? `Equipment ${a.assets.reference_number || a.assets.asset_category}` : a.sites ? `Site: ${a.sites.name}` : "Whole client"}</span></span><Button variant="ghost" size="sm" onClick={() => act(() => supabase.from("document_attachments").delete().eq("id", a.id), "Attachment removed")}>Detach</Button></div>)}</div>}
    <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent className="h-[96dvh] max-h-[96dvh] w-[98vw] max-w-[98vw] overflow-y-auto sm:max-w-[98vw] lg:p-5"><DialogHeader><DialogTitle>Edit document draft</DialogTitle></DialogHeader>{edit && <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"><div className="min-w-0 space-y-3"><Label>Name</Label><Input aria-label="Document name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /><div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"><p className="text-xs text-muted-foreground sm:col-span-2">Library tags — required before saving copies or publishing. Type a new value to add it.</p><div><Label htmlFor="doc-type">Type *</Label><Input id="doc-type" list="doc-type-options" value={docTypeLabel(edit.kind) === edit.kind ? edit.kind : docTypeLabel(edit.kind)} onChange={(e) => { const v = e.target.value; const preset = DOC_TYPE_PRESETS.find((k) => docTypeLabel(k).toLowerCase() === v.trim().toLowerCase()); setEdit({ ...edit, kind: preset ?? normalizeDocType(v) }); }} placeholder="Checklist, Contract…" /><datalist id="doc-type-options">{typeOptions.map((o) => <option key={o} value={docTypeLabel(o)} />)}</datalist></div><div><Label>Sector *</Label><Select value={edit.sector} onValueChange={(sector) => setEdit({ ...edit, sector })}><SelectTrigger aria-label="Sector"><SelectValue /></SelectTrigger><SelectContent>{SECTORS.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent></Select></div>{edit.kind === "contract" && <div><Label htmlFor="contract-type">Contract type *</Label><Input id="contract-type" list="contract-type-options" value={edit.contract_type} onChange={(e) => setEdit({ ...edit, contract_type: e.target.value })} placeholder="New maintenance, Renewal…" /><datalist id="contract-type-options">{contractTypeOptions.map((o) => <option key={o} value={o} />)}</datalist></div>}<div className="sm:col-span-2"><Label>Service tiers</Label><p className="text-xs text-muted-foreground">Tap to tag one or more tiers — selecting several adds a per-tier visits/price/discount block below.</p><div className="mt-1 flex flex-wrap gap-1">{tierOptions.map((t) => { const on = (edit.tier_ids ?? (edit.tier_id ? [edit.tier_id] : [])).includes(t.id); return <button key={t.id} type="button" aria-pressed={on} onClick={() => setEdit(applyTierToggle(edit, t, !on))} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted"}`}>{t.name}</button>; })}{tierOptions.length === 0 && <span className="text-xs text-muted-foreground">No tiers yet —</span>}<Link to="/contracts" search={{ tab: "types" }} className="inline-block px-1 py-1 text-xs text-primary underline">Add or rename tiers</Link></div></div></div><Label>Trade / equipment</Label><CompanyTradeSelect value={edit.trade} onChange={trade => setEdit({ ...edit, trade })} />
      <CommercialEditor liftEnabled={editLift} value={parseCommercial(edit.commercial)} onChange={(c) => setEdit({ ...edit, commercial: c as unknown as Json })} />
      <AudienceToggles value={parseAudience(edit.audience)} onChange={(audience) => setEdit({ ...edit, audience })} />
      <Label>Text (shown on both copies)</Label><Textarea rows={6} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
      <SectionEditor sections={parseSections(edit.sections)} onChange={(s) => setEdit({ ...edit, sections: s as unknown as Json })} />
      {edit.kind === "checklist" && <>
        <ChecklistRowEditor items={editItems} specs={editSpecs} onChange={(items, specs) => setEdit({ ...edit, items, field_specs: specs as unknown as Json })} />
      </>}
      <ExtrasEditor extras={parseExtras(edit.extras)} onChange={(x) => setEdit({ ...edit, extras: x as unknown as Json })} />
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => save()}>Save draft</Button><Button onClick={() => save("active")}>Publish</Button></div>
      <div className="space-y-2 rounded-lg border-2 border-primary/40 p-3"><Label>Save to the library</Label><p className="text-xs text-muted-foreground">Each button saves its own document in the library, clearly labelled, so admins can preview and attach the right one. Technician copies have checkboxes and no prices; client copies have bullet points.</p><div className="flex flex-wrap gap-2"><Button onClick={() => void saveCopy("technician")}>Save technician copy</Button><Button onClick={() => void saveCopy("client")}>Save client copy</Button><Button variant="outline" onClick={async () => { if (await saveCopy("technician") && await saveCopy("client")) setEdit(null); }}>Save both copies</Button>{tierOptions.length > 0 && <Select value="" onValueChange={(id) => { const t = tierOptions.find((x) => x.id === id); if (t) void saveCopy(null, t); }}><SelectTrigger className="h-9 w-48" aria-label="Duplicate into tier"><SelectValue placeholder="Duplicate into tier…" /></SelectTrigger><SelectContent>{tierOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>}</div></div></div><div className="min-w-0 lg:sticky lg:-top-5 lg:max-h-[90dvh] lg:self-start lg:overflow-y-auto lg:border-l lg:pl-5"><MasterPreview doc={edit} /></div></div>}</DialogContent></Dialog>
    <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}><DialogContent className="max-h-[92vh] w-[96vw] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Document preview</DialogTitle></DialogHeader>{preview && <>{!clientId && preview.state !== "archived" && <AudienceToggles value={parseAudience(preview.audience)} onChange={(audience) => { setPreview({ ...preview, audience }); void setAudience(preview, audience); }} />}<MasterPreview key={preview.id} doc={preview} initialView={defaultCopyView(preview.audience)} />{preview.state === "active" && <div className="flex flex-wrap gap-2 border-t pt-4">{!clientId && <Select value={client} onValueChange={(v) => { setClient(v); setSite(""); setAsset(""); }}><SelectTrigger className="w-56"><SelectValue placeholder="Choose client" /></SelectTrigger><SelectContent>{refs?.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>}{attachClient && <Select value={site || "all"} onValueChange={(v) => { setSite(v === "all" ? "" : v); setAsset(""); }}><SelectTrigger className="w-48" aria-label="Site"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sites</SelectItem>{siteAssets?.sites.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>}{attachClient && fitsAttachment(preview.audience, "field") && <Select value={asset || "none"} onValueChange={(v) => setAsset(v === "none" ? "" : v)}><SelectTrigger className="w-56" aria-label="Equipment"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Any equipment</SelectItem>{siteAssets?.assets.filter((x) => !site || x.site_id === site).map((x) => <SelectItem key={x.id} value={x.id}>{x.reference_number || x.asset_category}</SelectItem>)}</SelectContent></Select>}<Button disabled={!(clientId || client)} onClick={attach}><Paperclip className="mr-1 h-4 w-4" />Attach</Button></div>}</>}</DialogContent></Dialog>
    <Dialog open={picking} onOpenChange={setPicking}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Attach a document</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Choose a published library document. You can then preview it and pick the site or equipment.</p><div className="divide-y border-y">{docs.filter((d) => d.state === "active").map((d) => <button key={d.id} type="button" className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setPicking(false); setClient(clientId ?? ""); setSite(siteId ?? ""); setAsset(assetId ?? ""); setPreview(d); }}><span className="min-w-0"><span className="block truncate font-medium">{d.name}</span><span className="text-xs text-muted-foreground">{docTypeLabel(d.kind)} · {copyAudience(d.audience) === "technician" ? "Technician copy" : copyAudience(d.audience) === "client" ? "Client copy" : "Both copies"}</span></span><Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}{docs.every((d) => d.state !== "active") && <p className="py-4 text-sm text-muted-foreground">No published documents yet. Publish a document in the library first.</p>}</div></DialogContent></Dialog>
    <Dialog open={!!renaming} onOpenChange={open => !open && setRenaming(null)}><DialogContent><DialogHeader><DialogTitle>Rename document</DialogTitle></DialogHeader><Label htmlFor="rename-document">Document name</Label><Input id="rename-document" value={renameName} onChange={event => setRenameName(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button><Button disabled={!renameName.trim()} onClick={async () => { if (!renaming) return; if (await act(() => supabase.from("document_masters").update({ name: renameName.trim() }).eq("id", renaming.id), "Document renamed")) setRenaming(null); }}>Save name</Button></div></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setConfirmText(""); } }}><DialogContent><DialogHeader><DialogTitle>Delete document permanently?</DialogTitle></DialogHeader>{deleting && (() => { const u = usageOf(deleting); const inUse = u.clients.length > 0 || u.tiers.length > 0; return <div className="space-y-3"><p className="font-medium">{deleting.name}</p>
      {inUse ? <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"><p className="font-medium">This document is still in use.</p>{u.clients.length > 0 && <><p>Clients affected:</p><ul className="list-disc pl-5">{u.clients.map((n) => <li key={n}>{n}</li>)}</ul></>}{u.tiers.length > 0 && <p>Service tiers using it: {u.tiers.join(", ")}</p>}<p className="text-muted-foreground">Deleting will detach it from these clients and tiers. Already-signed agreements keep their saved copy. Archiving is safer if you may need it again.</p></div> : <p className="text-sm text-muted-foreground">Not attached to any client or tier.</p>}
      <Label htmlFor="confirm-delete">Type DELETE to confirm</Label><Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>{deleting.state !== "archived" && <Button variant="outline" onClick={async () => { if (await act(() => supabase.from("document_masters").update({ state: "archived" }).eq("id", deleting.id), "Document archived")) setDeleting(null); }}>Archive instead</Button>}<Button variant="destructive" disabled={confirmText.trim().toUpperCase() !== "DELETE"} onClick={async () => { const r = await supabase.rpc("delete_document_master", { _id: deleting.id }); if (r.error) { toast.error(r.error.message); return; } const res = r.data as { clients?: string[] } | null; const cl = res?.clients ?? []; if (cl.length) toast.warning(`Deleted “${deleting.name}”. Affected clients: ${cl.join(", ")}`, { duration: 12000 }); else toast.success(`Deleted “${deleting.name}”`); setDeleting(null); setConfirmText(""); refresh(); }}>Delete permanently</Button></div></div>; })()}</DialogContent></Dialog>
  </section>;
}
