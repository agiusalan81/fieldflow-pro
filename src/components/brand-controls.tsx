import { useState } from "react";
import { usePlanFeatures } from "@/lib/plan-features";
import { BrandingLock } from "./branding-lock";
import { BrandingUpload } from "./branding-upload";
import { DOCUMENT_FONT_OPTIONS } from "@/lib/branding-assets";
import { Pipette } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_TEXT_STYLES, DOCUMENT_STYLES, FIELD_LABELS, TEXT_LAYERS, layerColor, validColor, type PdfTemplate, type TextLayer, type TextLayerKey } from "@/lib/documents";
import { Bold, Italic, Underline } from "lucide-react";
import { extractPalette } from "@/lib/palette-extractor";
import { DocumentPreviewTabs } from "@/components/document-preview-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function BrandControls({ template: t, onChange, logo, companyId }: { template: PdfTemplate; onChange: (t: PdfTemplate) => void; logo?: string; companyId: string }) {
  const [palette, setPalette] = useState<string[]>([]);
  const on = usePlanFeatures();
  return <section className="grid gap-6 border-b pb-6 lg:grid-cols-2">
    <div className="space-y-5"><h2 className="text-lg font-semibold">Document & Brand Studio</h2>
      <BrandingLock allowed={on("branding_documents")} feature="branding_documents"><div className="grid grid-cols-3 gap-2">{DOCUMENT_STYLES.map((s) => <Button key={s} variant={t.stylePreset === s ? "default" : "outline"} onClick={() => onChange({ ...t, stylePreset: s, font: s === "classic" ? "serif" : s === "technical" ? "mono" : "sans" })} className="h-auto min-h-10 whitespace-normal capitalize">{s === "service" ? "Standard Service Sheet" : s}</Button>)}</div></BrandingLock>
      <div className="grid grid-cols-2 gap-3">{(["primaryColor", "accentColor"] as const).map((key) => <div key={key} className="space-y-2"><Label htmlFor={key}>{key === "primaryColor" ? "Brand colour" : "Accent colour"}</Label><div className="flex gap-2"><Input disabled={key === "accentColor" && !on("branding_documents")} id={key} aria-label={key === "primaryColor" ? "Brand colour" : "Accent colour"} type="color" className="h-10 w-14 p-1" value={t[key]} onChange={(e) => onChange({ ...t, [key]: e.target.value })} /><Input disabled={key === "accentColor" && !on("branding_documents")} aria-label={`${key} hex`} value={t[key]} onChange={(e) => onChange({ ...t, [key]: validColor(e.target.value, t[key]) })} /></div></div>)}</div>
      {logo && <div className="space-y-2"><Button variant="outline" onClick={async () => { try { setPalette(await extractPalette(logo)); } catch { toast.error("Could not sample this logo"); } }}><Pipette className="mr-2 h-4 w-4" />Sample logo colours</Button><div className="flex gap-2">{palette.map((color) => <Button key={color} aria-label={`Apply ${color}`} title={color} variant="outline" className="h-9 w-9 p-1" onClick={() => onChange({ ...t, primaryColor: color })}><span className="h-full w-full rounded-sm" style={{ backgroundColor: color }} /></Button>)}</div></div>}
      <BrandingLock allowed={on("branding_fonts")} feature="branding_fonts"><div className="space-y-2"><Label>Document font</Label><Select value={t.documentFont ?? "standard"} onValueChange={font => onChange({ ...t, documentFont: font as PdfTemplate["documentFont"] })}><SelectTrigger aria-label="Document font"><SelectValue /></SelectTrigger><SelectContent>{DOCUMENT_FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value} disabled={f.value === "custom" && (!on("branding_custom_fonts") || !t.fontPath)}>{f.label}</SelectItem>)}</SelectContent></Select></div><Select value={t.font} onValueChange={font => onChange({ ...t, font: font as PdfTemplate["font"] })}><SelectTrigger aria-label="Standard font family"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sans">Clean sans</SelectItem><SelectItem value="serif">Classic serif</SelectItem><SelectItem value="mono">Technical mono</SelectItem></SelectContent></Select></BrandingLock>
      <BrandingLock allowed={on("branding_custom_fonts")} feature="branding_custom_fonts"><BrandingUpload companyId={companyId} kind="fonts" label="Custom document font" path={t.fontPath ?? ""} onChange={(fontPath, fontName) => onChange({ ...t, fontPath, fontName, documentFont: fontPath ? "custom" : "standard" })} />{t.fontName && <p className="break-words text-xs">{t.fontName}</p>}</BrandingLock>
      <BrandingLock allowed={on("branding_documents")} feature="branding_documents"><div className="space-y-2"><Label>Document frame</Label><Select value={t.frame ?? "none"} onValueChange={frame => onChange({ ...t, frame: frame as PdfTemplate["frame"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No frame</SelectItem><SelectItem value="line">Fine line</SelectItem><SelectItem value="double">Double line</SelectItem></SelectContent></Select></div><BrandingUpload companyId={companyId} kind="backgrounds" label="Document background" path={t.backgroundPath ?? ""} onChange={backgroundPath => onChange({ ...t, backgroundPath })} /><div className="grid grid-cols-2 gap-3">{([['fieldBackground','Document field background'],['fieldText','Document field text']] as const).map(([key,label]) => <div key={key} className="space-y-2"><Label>{label}</Label><Input type="color" aria-label={label} className="h-10 w-14 p-1" value={t[key] ?? (key === "fieldBackground" ? "#ffffff" : "#202020")} onChange={e => onChange({ ...t, [key]: e.target.value })} /></div>)}</div></BrandingLock>
      <BrandingLock allowed={on("branding_documents")} feature="branding_documents"><TextLayerControls template={t} onChange={onChange} /></BrandingLock>
      <details className="border-t pt-3"><summary className="cursor-pointer font-medium">Field names</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(FIELD_LABELS).map(([key, label]) => <div key={key} className="space-y-1"><Label htmlFor={`word-${key}`}>{label}</Label><Input id={`word-${key}`} maxLength={80} placeholder={label} value={t.labels[key] ?? ""} onChange={(e) => onChange({ ...t, labels: { ...t.labels, [key]: e.target.value } })} /></div>)}</div></details>
    </div>
    <DocumentPreviewTabs template={t} logo={logo} className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto" />
  </section>;
}

/** Separate font, colour, bold and italic for company name, field headings and field details. */
function TextLayerControls({ template: t, onChange }: { template: PdfTemplate; onChange: (t: PdfTemplate) => void }) {
  const styles = t.textStyles ?? DEFAULT_TEXT_STYLES;
  const set = (k: TextLayerKey, patch: Partial<TextLayer>) => onChange({ ...t, textStyles: { ...styles, [k]: { ...styles[k], ...patch } } });
  return <div className="space-y-3 border-t pt-4"><div><h3 className="font-medium">Text styles</h3><p className="text-sm text-muted-foreground">Style the company name, field headings and field details separately.</p></div>
    {TEXT_LAYERS.map(({ key, label, hint }) => { const l = styles[key]; const colour = layerColor(t, key); return <div key={key} className="space-y-2 rounded-lg border p-3">
      <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={l.font} onValueChange={v => set(key, { font: v as TextLayer["font"] })}><SelectTrigger aria-label={`${label} font`} className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">Document font</SelectItem><SelectItem value="sans">Clean sans</SelectItem><SelectItem value="serif">Classic serif</SelectItem><SelectItem value="mono">Technical mono</SelectItem></SelectContent></Select>
        <Input type="color" aria-label={`${label} colour`} className="h-10 w-14 p-1" value={colour} onChange={e => set(key, { color: e.target.value })} />
        <Button type="button" size="icon" variant={l.bold ? "default" : "outline"} aria-label={`${label} bold`} aria-pressed={l.bold} onClick={() => set(key, { bold: !l.bold })}><Bold className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant={l.italic ? "default" : "outline"} aria-label={`${label} italic`} aria-pressed={l.italic} onClick={() => set(key, { italic: !l.italic })}><Italic className="h-4 w-4" /></Button>
        <Button type="button" size="icon" title={`${label} underline`} variant={l.underline ? "default" : "outline"} aria-label={`${label} underline`} aria-pressed={l.underline} onClick={() => set(key, { underline: !l.underline })}><Underline className="h-4 w-4" /></Button>
        {l.color && <Button type="button" size="sm" variant="ghost" onClick={() => set(key, { color: "" })}>Reset colour</Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Button background</Label>
        <Input type="color" aria-label={`${label} background`} className="h-9 w-14 p-1" value={l.background || "#ffffff"} onChange={e => set(key, { background: e.target.value })} />
        {l.background ? <Button type="button" size="sm" variant="ghost" onClick={() => set(key, { background: "" })}>No background</Button> : <span className="text-xs text-muted-foreground">Off — pick a colour to show it as a button</span>}
      </div>
      {l.italic && l.font === "document" && t.documentFont === "custom" && <p className="text-xs text-muted-foreground">Uploaded company fonts print upright in PDFs; choose a standard font for italic PDFs.</p>}
    </div>; })}
  </div>;
}
