import { documentLabel, visibleBlocks, type PdfTemplate } from "@/lib/documents";
import { ServiceSheet } from "@/components/service-sheet";
import type { CSSProperties } from "react";
import { useEffect } from "react";
import { documentFontFamily, loadDocumentFont } from "@/lib/branding-assets";

export function documentVariables(t: PdfTemplate): CSSProperties {
  return { "--document-primary": t.primaryColor, "--document-accent": t.accentColor, "--document-font": documentFontFamily(t), "--document-field-background": t.fieldBackground, "--document-field-text": t.fieldText, "--document-background-image": t.backgroundData ? `url("${t.backgroundData}")` : "none" } as CSSProperties;
}
export function DocumentPreview({ template, logo, mode = "document" }: { template: PdfTemplate; logo?: string | undefined; mode?: "document" | "form" }) {
  useEffect(() => { let active = true; let dispose: (() => unknown) | undefined; void loadDocumentFont(template).then(fn => { if (active) dispose = fn; else fn?.(); }).catch(() => {}); return () => { active = false; dispose?.(); }; }, [template.documentFont, template.fontData]);
  const samples: Record<string, string> = { client: "Sample client", address: "Sample service address", equipment: "Unit 02 · Model XJ-500 · SN 88412", fault: "Intermittent operation and unusual noise.", work: "Replaced worn components, adjusted alignment and completed functional tests.", timesheet: "18/10/2026     08:30 → 11:00     5.00 h", parts: "Guide assembly     pcs     4", notes: "Reception holds the service access key.", signoff: "Technician: A. Smith     Client: J. Jones" };
  if (template.stylePreset === "service" && mode === "document") return <ServiceSheet data={{ company: "Your Company", logo: logo ?? "", number: "1042", date: "18/10/2026", client: samples["client"] ?? "", address: samples["address"] ?? "", asset: samples["equipment"] ?? "", fault: samples["fault"] ?? "", repairs: samples["work"] ?? "", technician: "A. Smith", signedBy: "J. Jones", idCard: "", signature: null, logs: [{ date: "18/10/2026", in: "08:30", out: "11:00", travel: 0.5, total: 5, techs: "AS, JJ", count: 2 }], parts: [{ desc: "Guide assembly", unit: "pcs", qty: 4 }], notes: samples["notes"] ?? "", terms: null, template }}/>;
  return <article style={documentVariables(template)} data-frame={template.frame} data-style={template.stylePreset} className={`document-paper ${mode === "form" ? "document-form" : ""} mx-auto w-full max-w-lg space-y-4 border p-5 text-xs`}>
    <header className="document-header flex items-start justify-between gap-3 pb-4"><div className="flex items-center gap-2">{logo && <img alt="Company logo" src={logo} className="h-10 max-w-24 object-contain" />}<strong className="text-base">Your Company</strong></div><div className="text-right">Job sheet 1042<br />18/10/2026</div></header>
    {template.header && <p>{template.header}</p>}
    {visibleBlocks(template).map((key) => <section key={key} className="space-y-1"><h3 className="document-label text-[10px] font-semibold uppercase">{documentLabel(template, key)}</h3><p className={mode === "form" ? "border px-3 py-2" : ""}>{samples[key]}</p></section>)}
    {template.footer && <footer className="whitespace-pre-line break-words border-t pt-3 text-center">{template.footer.split(/(\S+@\S+\.\S+|https?:\/\/\S+)/).map((part, i) => i % 2 ? <a key={i} className="underline" href={part.includes("@") && !part.startsWith("http") ? `mailto:${part}` : part}>{part}</a> : part)}</footer>}
  </article>;
}