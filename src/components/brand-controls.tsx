import { useState } from "react";
import { Pipette } from "lucide-react";
import { toast } from "sonner";
import { DOCUMENT_STYLES, FIELD_LABELS, validColor, type PdfTemplate } from "@/lib/documents";
import { extractPalette } from "@/lib/palette-extractor";
import { DocumentPreview } from "@/components/document-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function BrandControls({ template: t, onChange, logo }: { template: PdfTemplate; onChange: (t: PdfTemplate) => void; logo?: string }) {
  const [palette, setPalette] = useState<string[]>([]);
  return <section className="grid gap-6 border-b pb-6 lg:grid-cols-2">
    <div className="space-y-5"><h2 className="text-lg font-semibold">Document & Brand Studio</h2>
      <div className="grid grid-cols-3 gap-2">{DOCUMENT_STYLES.map((s) => <Button key={s} variant={t.stylePreset === s ? "default" : "outline"} onClick={() => onChange({ ...t, stylePreset: s, font: s === "classic" ? "serif" : s === "technical" ? "mono" : "sans" })} className="capitalize">{s}</Button>)}</div>
      <div className="grid grid-cols-2 gap-3">{(["primaryColor", "accentColor"] as const).map((key) => <div key={key} className="space-y-2"><Label htmlFor={key}>{key === "primaryColor" ? "Brand colour" : "Accent colour"}</Label><div className="flex gap-2"><Input id={key} aria-label={key === "primaryColor" ? "Brand colour" : "Accent colour"} type="color" className="h-10 w-14 p-1" value={t[key]} onChange={(e) => onChange({ ...t, [key]: e.target.value })} /><Input aria-label={`${key} hex`} value={t[key]} onChange={(e) => onChange({ ...t, [key]: validColor(e.target.value, t[key]) })} /></div></div>)}</div>
      {logo && <div className="space-y-2"><Button variant="outline" onClick={async () => { try { setPalette(await extractPalette(logo)); } catch { toast.error("Could not sample this logo"); } }}><Pipette className="mr-2 h-4 w-4" />Sample logo colours</Button><div className="flex gap-2">{palette.map((color) => <Button key={color} aria-label={`Apply ${color}`} title={color} variant="outline" className="h-9 w-9 p-1" onClick={() => onChange({ ...t, primaryColor: color })}><span className="h-full w-full rounded-sm" style={{ backgroundColor: color }} /></Button>)}</div></div>}
      <div className="space-y-2"><Label>Document font</Label><Select value={t.font} onValueChange={(font) => onChange({ ...t, font: font as PdfTemplate["font"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sans">Clean sans</SelectItem><SelectItem value="serif">Classic serif</SelectItem><SelectItem value="mono">Technical mono</SelectItem></SelectContent></Select></div>
      <details className="border-t pt-3"><summary className="cursor-pointer font-medium">Field names</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(FIELD_LABELS).map(([key, label]) => <div key={key} className="space-y-1"><Label htmlFor={`word-${key}`}>{label}</Label><Input id={`word-${key}`} maxLength={80} placeholder={label} value={t.labels[key] ?? ""} onChange={(e) => onChange({ ...t, labels: { ...t.labels, [key]: e.target.value } })} /></div>)}</div></details>
    </div>
    <Tabs defaultValue="paper"><TabsList className="mb-4"><TabsTrigger value="paper">Client document</TabsTrigger><TabsTrigger value="form">Entry form</TabsTrigger></TabsList><TabsContent value="paper"><DocumentPreview template={t} logo={logo} /></TabsContent><TabsContent value="form"><DocumentPreview template={t} logo={logo} mode="form" /></TabsContent></Tabs>
  </section>;
}