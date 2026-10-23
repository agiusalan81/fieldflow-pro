import { useEffect, useState } from "react";
import { settingsSectionPatch } from "@/lib/settings-sections";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Download, FileUp, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BLOCKS, DOC_TYPES, moveBlock, parsePresets, parseTemplate, parseTerms, termsFor, visibleBlocks, type NotePreset, type PdfTemplate, type Terms } from "@/lib/documents";
import { buildPdf } from "@/lib/sendJobSheetEmail";
import { formatOfficeAddress, parseOfficeAddress } from "@/lib/contact-details";
import { BrandControls } from "@/components/brand-controls";
import { BrandingLock } from "@/components/branding-lock";
import { usePlanFeatures } from "@/lib/plan-features";
import { contrastRatio } from "@/lib/branding";
import { resolveDocumentAssets } from "@/lib/branding-assets";
import { DocumentPreview } from "@/components/document-preview";
import { MobileDocumentPreview } from "@/components/document-preview-tabs";
import { useCompanyTitle } from "@/lib/company-name";
import { extractDocumentText } from "@/lib/document-library.functions";
import { DOC_CATEGORIES, type DocCategory } from "@/components/document-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const label = (k: string) => BLOCKS.find((b) => b.key === k)?.label ?? k;

export function DocumentSettings({ companyId, part }: { companyId: string; part: "branding" | "terms" }) {
  const planOn = usePlanFeatures();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["doc-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("pdf_template, terms, note_presets, logo_data, office_address, company_address, vat_number, office_phone, company_email").maybeSingle()).data,
  });
  const [t, setT] = useState<PdfTemplate | null>(null);
  const [resolved, setResolved] = useState<PdfTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [presets, setPresets] = useState<NotePreset[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [importFor, setImportFor] = useState<"job_sheet" | "estimate" | "agreement" | null>(null);
  const libraryName = useCompanyTitle("document library");
  const [importing, setImporting] = useState(false);
  const { data: libraryDocs = [] } = useQuery({
    queryKey: ["company-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_documents").select("id, name, category").order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; name: string; category: DocCategory }[];
    },
  });
  const importDoc = async (id: string) => {
    if (!importFor) return;
    setImporting(true);
    try {
      const { text } = await extractDocumentText({ data: { documentId: id } });
      setTerms((cur) => cur ? { ...cur, [importFor]: { ...cur[importFor], text } } : cur);
      toast.success("Text imported — review it below, then save.");
      setImportFor(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read that document"); }
    setImporting(false);
  };
  useEffect(() => {
    if (data !== undefined && !t) { setT(parseTemplate(data?.pdf_template)); setTerms(parseTerms(data?.terms)); setPresets(parsePresets(data?.note_presets)); }
  }, [data, t]);
  useEffect(() => { if (!t) return; let active = true; void resolveDocumentAssets(supabase, t).then(value => { if (active) setResolved(value); }).catch(() => toast.error("Could not load document branding")); return () => { active = false; }; }, [t]);
  if (!t || !terms) return null;

  const save = async () => {
    if (part === "branding" && contrastRatio(t.fieldBackground ?? "#ffffff", t.fieldText ?? "#202020") < 4.5) { toast.error("Choose document field colours with stronger contrast"); return; }
    setSaving(true);
    const { data: latest, error: readError } = await supabase.from("company_settings").select("pdf_template").maybeSingle();
    if (readError) { toast.error(readError.message); setSaving(false); return; }
    const prior = (latest?.pdf_template ?? {}) as Record<string, unknown>;
    const next = { ...prior, primaryColor: t.primaryColor, labels: t.labels, header: t.header, footer: t.footer, showTravel: t.showTravel,
      ...(planOn("branding_documents") ? { order: t.order, hidden: t.hidden, stylePreset: t.stylePreset, accentColor: t.accentColor, frame: t.frame, backgroundPath: t.backgroundPath, fieldBackground: t.fieldBackground, fieldText: t.fieldText, textStyles: t.textStyles } : {}),
      ...(planOn("branding_fonts") ? { font: t.font, documentFont: t.documentFont } : {}),
      ...(planOn("branding_custom_fonts") ? { fontPath: t.fontPath, fontName: t.fontName } : {}) };
    const patch = settingsSectionPatch(part, { pdf_template: next, terms, note_presets: presets.filter(p => p.label.trim()) });
    const { error } = await supabase.from("company_settings").upsert({ company_id: companyId, ...patch } as never);
    setSaving(false); if (error) { toast.error(error.message); return; }
    toast.success("Document templates saved");
    qc.invalidateQueries({ queryKey: ["doc-settings"] });
    qc.invalidateQueries({ queryKey: ["company-settings"] });
    qc.invalidateQueries({ queryKey: ["note-presets"] });
  };
  const toggle = (k: PdfTemplate["order"][number]) => setT({ ...t, hidden: t.hidden.includes(k) ? t.hidden.filter((x) => x !== k) : [...t.hidden, k] });

  const SAMPLE = {
    company: "Your Company Ltd", number: "1042", date: new Date().toLocaleDateString("en-GB"),
    client: "Plaza Hotel Ltd", address: "Tower Road, Sliema", asset: "Elevator - LFT-02 - Model XJ-500 - S/N 88412",
    fault: "Lift stops between floors 2 and 3 with a loud grinding noise.",
    repairs: "Replaced worn guide rollers on the car frame, re-aligned the door tracks and tested 20 full travel cycles. Operation is now smooth and quiet.",
    technician: "Jorey Gloria", signedBy: "Mario Camilleri", idCard: "123456M",
    logs: [
      { date: new Date().toISOString().slice(0, 10), in: "08:30", out: "11:00", travel: 0.5, total: 5, techs: "JG, AA", count: 2 },
    ],
    parts: [{ desc: "Guide roller assembly 90mm", unit: "pcs", qty: 4 }],
    notes: "Parking is at the rear of the building; ask reception for the service lift key.",
  };

  const downloadSample = async () => {
    try {
      const pdf = await buildPdf({
        officeAddress: formatOfficeAddress(parseOfficeAddress(data?.office_address, data?.company_address ?? "")), vatNumber: data?.vat_number ?? "", contact: [data?.office_phone, data?.company_email].filter(Boolean).join("\n"),
        company: SAMPLE.company, logo: data?.logo_data ?? "", number: SAMPLE.number, date: SAMPLE.date, client: SAMPLE.client,
        address: SAMPLE.address, asset: SAMPLE.asset, fault: SAMPLE.fault, repairs: SAMPLE.repairs, technician: SAMPLE.technician,
        signedBy: SAMPLE.signedBy, idCard: SAMPLE.idCard, signature: null, logs: SAMPLE.logs, parts: SAMPLE.parts,
        notes: SAMPLE.notes, terms: termsFor(terms, "job_sheet"), template: await resolveDocumentAssets(supabase, t),
      });
      const url = URL.createObjectURL(new Blob([pdf as unknown as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `Job_sheet-${SAMPLE.number}_Sample.pdf`; a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { toast.error("Could not build the sample PDF"); }
  };

  return (
    <div className="space-y-4">
      {part === "branding" && <>
      <MobileDocumentPreview template={resolved ? { ...t, fontData: resolved.fontData, backgroundData: resolved.backgroundData } : t} logo={data?.logo_data ?? ""} />
      <BrandControls companyId={companyId} template={resolved ? { ...t, fontData: resolved.fontData, backgroundData: resolved.backgroundData } : t} onChange={value => { const { fontData: _f, backgroundData: _b, ...stored } = value; setT(stored); }} logo={data?.logo_data ?? ""} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div><h2 className="font-medium text-foreground">Job sheet PDF layout</h2><p className="text-sm text-muted-foreground">Drag sections to reorder. Switch off anything you don't want clients to see.</p></div>
          <div className="space-y-1.5"><Label>Header text</Label><Input placeholder="e.g. Licensed lift contractor · VAT MT1234" value={t.header} onChange={(e) => setT({ ...t, header: e.target.value })} /></div>
          <BrandingLock allowed={planOn("branding_documents")} feature="branding_documents"><ul className="space-y-1.5">
            {t.order.map((k, i) => (
              <li key={k} draggable={planOn("branding_documents")} onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (planOn("branding_documents") && drag !== null) setT({ ...t, order: moveBlock(t.order, drag, i) }); setDrag(null); }}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${t.hidden.includes(k) ? "opacity-50" : ""}`}>
                <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                <span className="flex-1">{label(k)}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up" onClick={() => setT({ ...t, order: moveBlock(t.order, i, i - 1) })}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down" onClick={() => setT({ ...t, order: moveBlock(t.order, i, i + 1) })}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Switch aria-label={`Show ${label(k)}`} checked={!t.hidden.includes(k)} onCheckedChange={() => toggle(k)} />
              </li>
            ))}
          </ul></BrandingLock>
          <label className="flex items-center gap-2 text-sm"><Switch checked={t.showTravel} onCheckedChange={(c) => setT({ ...t, showTravel: c })} />Show travel hours in the time sheet</label>
          <div className="space-y-1.5"><Label>Footer text</Label><p className="text-xs text-muted-foreground">Multiple lines allowed. Email addresses and web links become clickable.</p><Textarea rows={4} maxLength={1000} placeholder={"e.g. Thank you for choosing us\noffice@yourcompany.com · www.yourcompany.com"} value={t.footer} onChange={(e) => setT({ ...t, footer: e.target.value })} /></div>
        </section>

        <section className="hidden rounded-xl border bg-card p-5 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview — what the client receives</p>
            <Button size="sm" variant="outline" onClick={downloadSample}><Download className="mr-1 h-3.5 w-3.5" />Sample PDF</Button>
          </div>
          <DocumentPreview template={resolved ?? t} logo={data?.logo_data ?? ""} />
          <p className="mt-2 text-xs text-muted-foreground">Sample data shown. Download the sample PDF to see the exact file the client receives by email.</p>
        </section>
      </div>
      </>}

      {part === "terms" && <>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Terms & conditions</h2><p className="text-sm text-muted-foreground">Printed at the end of the client PDF when switched on. Write your own text, or import it from a document in the library.</p></div>
        {DOC_TYPES.map((d) => (
          <div key={d.key} className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center justify-between text-sm font-medium">{d.label}<Switch checked={terms[d.key].enabled} onCheckedChange={(c) => setTerms({ ...terms, [d.key]: { ...terms[d.key], enabled: c } })} /></label>
            {terms[d.key].enabled && (
              <>
                <Textarea rows={4} placeholder="Write your own terms here…" value={terms[d.key].text} onChange={(e) => setTerms({ ...terms, [d.key]: { ...terms[d.key], text: e.target.value } })} />
                <Button type="button" size="sm" variant="outline" onClick={() => setImportFor(d.key)}>
                  <FileUp className="mr-1 h-4 w-4" />Import from {libraryName}
                </Button>
              </>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Estimates and agreements will use these once their PDFs are generated.</p>
      </section>

      <Dialog open={!!importFor} onOpenChange={(o) => { if (!o && !importing) setImportFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import terms from the {libraryName}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Pick a document — its text will be read and placed in the editor so you can review and adjust it before saving.</p>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {libraryDocs.length === 0 && <p className="text-sm text-muted-foreground">No documents in the library yet. Upload one in the {libraryName} tab first.</p>}
            {libraryDocs.map((doc) => (
              <button key={doc.id} type="button" disabled={importing} onClick={() => void importDoc(doc.id)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent disabled:opacity-50">
                {importing ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{doc.name}</span>
                  <span className="block text-xs text-muted-foreground">{DOC_CATEGORIES.find((c) => c.value === doc.category)?.label ?? doc.category}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Special note presets</h2><p className="text-sm text-muted-foreground">Quick notes technicians can add to a job sheet before sending it.</p></div>
        {presets.map((p, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)_auto]">
            <Input placeholder="Button label" value={p.label} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <Input placeholder="Note text" value={p.text} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
            <Button size="icon" variant="ghost" aria-label="Remove preset" onClick={() => setPresets(presets.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setPresets([...presets, { label: "", text: "" }])}><Plus className="mr-1 h-4 w-4" />Add preset</Button>
      </section>

      </>}

      <div className={part === "branding" ? "pb-16 lg:pb-0" : undefined}><Button className="h-11" disabled={saving} onClick={save}>{saving ? "Saving…" : part === "terms" ? "Save terms & notes" : "Save PDF styling"}</Button>{part === "branding" && <Button variant="outline" className="ml-2 h-11 lg:hidden" onClick={downloadSample}><Download className="mr-1 h-4 w-4" />Sample PDF</Button>}</div>
    </div>
  );
}
