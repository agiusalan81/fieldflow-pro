import { usePlanFeatures } from "@/lib/plan-features";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Eye, Archive, Plus, Trash2, Paperclip, Pencil, Download } from "lucide-react";
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
import { BILLING_CYCLES, DEFAULT_LIFT_PRICING, audienceCopyRows, stepPrice, specChoices, checklistRows, extrasFor, hasCommercial, parseCommercial, parseExtras, parseFieldSpecs, specShows, type BlockAudience, type Commercial, type Extra, type FieldSpec } from "@/lib/document-blocks";
import { ChecklistRowEditor } from "@/components/checklist-row-editor";
import { RichText } from "@/components/rich-text";
import { Camera } from "lucide-react";
import { useCompanyRules } from "@/lib/company";
import { companyHasLiftTrade, isLiftTrade } from "@/lib/trade-association";
import { CompanyTradeSelect } from "@/components/company-trade-select";
import { buildMasterDocumentPdf } from "@/lib/master-document-pdf";
import { CommercialPriceSummary, LiftCommercialEditor } from "@/components/lift-commercial";

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
      {commercial.visitsPerYear !== null && <p>{commercial.visitsPerYear} visits per year</p>}
      <CommercialPriceSummary value={commercial} cycle={BILLING_CYCLES.find((c) => c.key === commercial.billingCycle)?.label.toLowerCase()} />
      {(commercial.labourDiscountPct > 0 || commercial.partsDiscountPct > 0) && <p>Discounts: {commercial.labourDiscountPct > 0 && `${commercial.labourDiscountPct}% labour`}{commercial.labourDiscountPct > 0 && commercial.partsDiscountPct > 0 && " · "}{commercial.partsDiscountPct > 0 && `${commercial.partsDiscountPct}% parts`}</p>}
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
  return <div className="space-y-3 rounded-lg border p-3"><div className="flex items-center justify-between"><Label>Document setup — pricing engine & service terms</Label><label className="flex items-center gap-2 text-xs">Show prices on client copy<Switch checked={value.showOnClient} onCheckedChange={(showOnClient) => onChange({ ...value, showOnClient })} /></label></div>
    <p className="text-xs text-muted-foreground">Optional. Leave price empty for a pure checklist document. Technicians never see this block.</p>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>Visits / year</Label><Input min={0} type="number" value={value.visitsPerYear ?? ""} onChange={(e) => onChange({ ...value, visitsPerYear: e.target.value === "" ? null : Number(e.target.value) })} /></div>
      <div><Label>Base price (€)</Label><Input min={0} step="0.01" type="number" value={value.basePrice ?? ""} onChange={(e) => onChange({ ...value, basePrice: e.target.value === "" ? null : Number(e.target.value) })} /></div>
      <div><Label>Billing cycle</Label><Select value={value.billingCycle} onValueChange={(v) => onChange({ ...value, billingCycle: v as Commercial["billingCycle"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BILLING_CYCLES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-2"><div><Label>Labour disc %</Label><Input min={0} max={100} type="number" value={value.labourDiscountPct} onChange={(e) => onChange({ ...value, labourDiscountPct: Number(e.target.value) })} /></div><div><Label>Parts disc %</Label><Input min={0} max={100} type="number" value={value.partsDiscountPct} onChange={(e) => onChange({ ...value, partsDiscountPct: Number(e.target.value) })} /></div></div>
    </div>
    {liftEnabled && <LiftCommercialEditor alwaysOn value={value.liftPricing ? value : { ...value, liftPricing: { ...DEFAULT_LIFT_PRICING } }} onChange={onChange} />}
    <div><Label>Terms</Label><Textarea rows={3} value={value.terms} onChange={(e) => onChange({ ...value, terms: e.target.value })} placeholder="Payment terms, response times, exclusions…" /></div></div>;
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

export function DocumentMasters({ companyId, clientId }: { companyId: string; clientId?: string }) {
  const qc = useQueryClient();
  const { data: company } = useCompanyRules();
  const planOn = usePlanFeatures();
  const liftEnabled = companyHasLiftTrade(company?.industry, company?.trades) && planOn("lift_pack");
  const [edit, setEdit] = useState<Master | null>(null);
  const editLift = liftEnabled && (!edit?.trade || isLiftTrade(edit.trade));
  const [renaming, setRenaming] = useState<Master | null>(null);
  const [renameName, setRenameName] = useState("");
  const [filter, setFilter] = useState("all"); const [preview, setPreview] = useState<Master | null>(null); const [deleting, setDeleting] = useState<Master | null>(null); const [client, setClient] = useState(clientId ?? "");
  const { data: docs = [] } = useQuery({ queryKey: ["document-masters"], queryFn: async () => { const r = await supabase.from("document_masters").select("*").order("created_at", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  const { data: refs } = useQuery({ queryKey: ["master-usage"], queryFn: async () => { const [a, t, c] = await Promise.all([supabase.from("document_attachments").select("*, clients(name)"), supabase.from("contract_types").select("id,name,base_document_id,checklist_document_id,maintenance_agreements(clients(name))"), supabase.from("clients").select("id,name").order("name")]); if (a.error || t.error || c.error) throw a.error || t.error || c.error; return { attachments: a.data, tiers: t.data, clients: c.data }; } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["document-masters"] }); void qc.invalidateQueries({ queryKey: ["master-usage"] }); };
  const act = async (action: () => PromiseLike<{ error: { message: string } | null }>, message: string) => { const r = await action(); if (r.error) { toast.error(r.error.message); return false; } toast.success(message); refresh(); return true; };
  const create = async () => { const r = await supabase.from("document_masters").insert({ company_id: companyId, name: "Untitled document" }).select("*").single(); if (r.error) toast.error(r.error.message); else { setEdit(r.data); refresh(); } };
  const clone = async (d: Master) => { const r = await supabase.from("document_masters").insert({ company_id: companyId, name: `${d.name} — copy`, kind: d.kind, trade: d.trade, body: d.body, items: d.items, sections: d.sections, audience: d.audience, cloned_from: d.id, revision: d.revision + 1, field_specs: d.field_specs, commercial: d.commercial, extras: d.extras }).select("*").single(); if (r.error) toast.error(r.error.message); else { setEdit(r.data); refresh(); } };
  const save = async (state = "draft") => {
    if (!edit) return;
    if (!edit.name.trim()) { toast.error("Enter a document name"); return; }
    const sections = parseSections(edit.sections).filter((s) => s.title.trim() || s.body.trim());
    const rows = checklistRows(edit.items, edit.field_specs).filter(row => row.item.trim());
    const items = rows.map(row => row.item.trim());
    const specs = rows.map(row => row.spec);
    const parsedCommercial = parseCommercial(edit.commercial);
    const commercial = editLift && !parsedCommercial.liftPricing ? { ...parsedCommercial, liftPricing: { ...DEFAULT_LIFT_PRICING } } : parsedCommercial;
    const extras = parseExtras(edit.extras);
    if (await act(() => supabase.from("document_masters").update({ name: edit.name.trim(), kind: edit.kind, trade: edit.trade, body: edit.body, items, sections: sections as unknown as Json, audience: parseAudience(edit.audience), state, field_specs: specs as unknown as Json, commercial: commercial as unknown as Json, extras: extras as unknown as Json }).eq("id", edit.id), state === "active" ? "Document published" : "Draft saved")) setEdit(null);
  };
  const saveCopy = async (view: "technician" | "client" | null, tier?: string) => {
    if (!edit) return;
    const rows = view ? audienceCopyRows(edit.items, edit.field_specs, view) : { items: edit.items.filter(i => i.trim()), specs: checklistRows(edit.items, edit.field_specs).filter(r => r.item.trim()).map(r => r.spec) };
    const base = edit.name.trim() || "Untitled document";
    const name = view ? `${base} — ${view === "technician" ? "Tech" : "Client"} Copy` : `${base} — ${tier}`;
    const sections = view ? parseSections(edit.sections).filter(s => s.audience === "both" || s.audience === view).map(s => ({ ...s, audience: view })) : parseSections(edit.sections);
    const extras = view ? extrasFor(parseExtras(edit.extras), view) : parseExtras(edit.extras);
    const commercial = view === "technician" ? null : edit.commercial;
    const r = await supabase.from("document_masters").insert({ company_id: companyId, name, kind: edit.kind, trade: edit.trade, body: edit.body, items: rows.items, field_specs: rows.specs as unknown as Json, sections: sections as unknown as Json, extras: extras as unknown as Json, ...(commercial ? { commercial } : {}), audience: view ? [view] : parseAudience(edit.audience), cloned_from: edit.id }).select("id").single();
    if (r.error) toast.error(r.error.message); else { toast.success(`Saved “${name}” as a new draft`); refresh(); }
  };
  const setAudience = async (d: Master, audience: Audience[]) => { await act(() => supabase.from("document_masters").update({ audience }).eq("id", d.id), "Visibility updated"); };
  const usersOf = (d: Master) => [...(refs?.attachments ?? []).filter((a) => a.master_id === d.id).map((a) => a.clients?.name ?? "Client"), ...(refs?.tiers ?? []).filter((t) => t.base_document_id === d.id || t.checklist_document_id === d.id).flatMap((t) => [t.name, ...t.maintenance_agreements.map((a) => a.clients?.name ?? "Client")])];
  const attach = async () => { if (!preview || !(clientId || client)) return; if (await act(() => supabase.from("document_attachments").insert({ company_id: companyId, client_id: clientId || client, master_id: preview.id }), "Document attached")) setPreview(null); };
  const list = docs.filter((d) => (!clientId || d.state === "active") && (filter === "all" || d.state === filter));
  const audienceLabel = (d: Master) => { const a = parseAudience(d.audience); return a.length === 2 ? "Technicians & clients" : a.length === 0 ? "Office only" : a[0] === "client" ? "Clients only" : "Technicians only"; };
  const editItems = edit?.items ?? [];
  const editSpecs = edit ? parseFieldSpecs(edit.field_specs, editItems.length) : [];
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Reusable documents</h2><div className="flex gap-2"><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{["all", "draft", "active", "archived"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>{!clientId && <Button onClick={create}><Plus className="mr-1 h-4 w-4" />New draft</Button>}</div></div>
    {list.length === 0 && <p className="py-6 text-sm text-muted-foreground">No documents in this view.</p>}
    <div className="divide-y border-y">{list.map((d) => <div key={d.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.kind} · {d.state} · Revision {d.revision}{d.trade && ` · ${d.trade}`} · {audienceLabel(d)}</p></div><Button title="Preview" aria-label={`Preview ${d.name}`} size="icon" variant="ghost" onClick={() => { setPreview(d); setClient(clientId ?? ""); }}><Eye className="h-4 w-4" /></Button>{!clientId && <><Button title="Rename" aria-label={`Rename ${d.name}`} size="icon" variant="ghost" onClick={() => { setRenaming(d); setRenameName(d.name); }}><Pencil className="h-4 w-4" /></Button><Button title="Clone" aria-label={`Clone ${d.name}`} size="icon" variant="ghost" onClick={() => clone(d)}><Copy className="h-4 w-4" /></Button>{d.state === "draft" && <Button size="sm" variant="outline" onClick={() => setEdit(d)}>Edit draft</Button>}{d.state === "active" && <Button title="Archive" aria-label={`Archive ${d.name}`} size="icon" variant="ghost" onClick={() => act(() => supabase.from("document_masters").update({ state: "archived" }).eq("id", d.id), "Document archived")}><Archive className="h-4 w-4" /></Button>}<Button title="Delete" aria-label={`Delete ${d.name}`} size="icon" variant="ghost" onClick={() => setDeleting(d)}><Trash2 className="h-4 w-4" /></Button></>}</div>)}</div>
    {clientId && <div className="space-y-2">{refs?.attachments.filter((a) => a.client_id === clientId).map((a) => <div key={a.id} className="flex items-center justify-between border p-3 text-sm"><span>{docs.find((d) => d.id === a.master_id)?.name ?? "Attached document"}</span><Button variant="ghost" size="sm" onClick={() => act(() => supabase.from("document_attachments").delete().eq("id", a.id), "Attachment removed")}>Detach</Button></div>)}</div>}
    <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent className="max-h-[92vh] w-[96vw] overflow-y-auto sm:max-w-7xl"><DialogHeader><DialogTitle>Edit document draft</DialogTitle></DialogHeader>{edit && <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><div className="min-w-0 space-y-3"><Label>Name</Label><Input aria-label="Document name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /><Label>Type</Label><Select value={edit.kind} onValueChange={(kind) => setEdit({ ...edit, kind })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["contract", "checklist", "terms", "other"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select><Label>Trade / equipment</Label><CompanyTradeSelect value={edit.trade} onChange={trade => setEdit({ ...edit, trade })} />
      <CommercialEditor liftEnabled={editLift} value={parseCommercial(edit.commercial)} onChange={(c) => setEdit({ ...edit, commercial: c as unknown as Json })} />
      <AudienceToggles value={parseAudience(edit.audience)} onChange={(audience) => setEdit({ ...edit, audience })} />
      <Label>Text (shown on both copies)</Label><Textarea rows={6} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
      <SectionEditor sections={parseSections(edit.sections)} onChange={(s) => setEdit({ ...edit, sections: s as unknown as Json })} />
      {edit.kind === "checklist" && <>
        <ChecklistRowEditor items={editItems} specs={editSpecs} onChange={(items, specs) => setEdit({ ...edit, items, field_specs: specs as unknown as Json })} />
      </>}
      <ExtrasEditor extras={parseExtras(edit.extras)} onChange={(x) => setEdit({ ...edit, extras: x as unknown as Json })} />
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => save()}>Save draft</Button><Button onClick={() => save("active")}>Publish</Button></div>
      <div className="space-y-2 rounded-lg border p-3"><Label>Save standalone copies</Label><p className="text-xs text-muted-foreground">Creates a separate draft formatted for one audience. Your current changes are included.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => saveCopy("technician")}>Save technician copy</Button><Button size="sm" variant="outline" onClick={() => saveCopy("client")}>Save client copy</Button><Select value="" onValueChange={tier => saveCopy(null, tier)}><SelectTrigger className="h-9 w-44" aria-label="Duplicate into tier"><SelectValue placeholder="Duplicate into tier…" /></SelectTrigger><SelectContent>{["Bronze", "Silver", "Gold", "Platinum"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div></div></div><div className="min-w-0 lg:sticky lg:-top-6 lg:max-h-[88vh] lg:self-start lg:overflow-y-auto lg:border-l lg:pl-5"><MasterPreview doc={edit} /></div></div>}</DialogContent></Dialog>
    <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}><DialogContent className="max-h-[92vh] w-[96vw] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Document preview</DialogTitle></DialogHeader>{preview && <>{!clientId && preview.state !== "archived" && <AudienceToggles value={parseAudience(preview.audience)} onChange={(audience) => { setPreview({ ...preview, audience }); void setAudience(preview, audience); }} />}<MasterPreview doc={preview} />{preview.state === "active" && <div className="flex gap-2 border-t pt-4">{!clientId && <Select value={client} onValueChange={setClient}><SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger><SelectContent>{refs?.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>}<Button disabled={!(clientId || client)} onClick={attach}><Paperclip className="mr-1 h-4 w-4" />Attach</Button></div>}</>}</DialogContent></Dialog>
    <Dialog open={!!renaming} onOpenChange={open => !open && setRenaming(null)}><DialogContent><DialogHeader><DialogTitle>Rename document</DialogTitle></DialogHeader><Label htmlFor="rename-document">Document name</Label><Input id="rename-document" value={renameName} onChange={event => setRenameName(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button><Button disabled={!renameName.trim()} onClick={async () => { if (!renaming) return; if (await act(() => supabase.from("document_masters").update({ name: renameName.trim() }).eq("id", renaming.id), "Document renamed")) setRenaming(null); }}>Save name</Button></div></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Remove document?</DialogTitle></DialogHeader>{deleting && <><p>{deleting.name}</p>{usersOf(deleting).length > 0 && <ul className="list-disc pl-5">{[...new Set(usersOf(deleting))].map((n) => <li key={n}>{n}</li>)}</ul>}<p className="text-sm text-muted-foreground">{deleting.state !== "draft" || usersOf(deleting).length ? "Published or assigned documents are preserved. Archive this document instead." : "This unassigned draft will be permanently removed."}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>{deleting.state !== "draft" || usersOf(deleting).length ? <Button onClick={async () => { if (await act(() => supabase.from("document_masters").update({ state: "archived" }).eq("id", deleting.id), "Document archived")) setDeleting(null); }}>Archive</Button> : <Button variant="destructive" onClick={async () => { if (await act(() => supabase.from("document_masters").delete().eq("id", deleting.id), "Draft deleted")) setDeleting(null); }}>Delete draft</Button>}</div></>}</DialogContent></Dialog>
  </section>;
}
