import { documentLabel, visibleBlocks, type PdfTemplate } from "@/lib/documents";
import { ServiceSheet } from "@/components/service-sheet";
import type { CSSProperties } from "react";

export function documentVariables(t: PdfTemplate): CSSProperties {
  return { "--document-primary": t.primaryColor, "--document-accent": t.accentColor, "--document-font": t.font === "serif" ? '"Lora", Georgia, serif' : t.font === "mono" ? '"IBM Plex Mono", monospace' : '"IBM Plex Sans", sans-serif' } as CSSProperties;
}
export function DocumentPreview({ template, logo, mode = "document" }: { template: PdfTemplate; logo?: string | undefined; mode?: "document" | "form" }) {
  const samples: Record<string, string> = { client: "Sample client", address: "Sample service address", equipment: "Unit 02 · Model XJ-500 · SN 88412", fault: "Intermittent operation and unusual noise.", work: "Replaced worn components, adjusted alignment and completed functional tests.", timesheet: "18/10/2026     08:30 → 11:00     5.00 h", parts: "Guide assembly     pcs     4", notes: "Reception holds the service access key.", signoff: "Technician: A. Smith     Client: J. Jones" };
  if (template.stylePreset === "service" && mode === "document") return <ServiceSheet data={{ company: "Your Company", logo: logo ?? "", number: "1042", date: "18/10/2026", client: samples["client"] ?? "", address: samples["address"] ?? "", asset: samples["equipment"] ?? "", fault: samples["fault"] ?? "", repairs: samples["work"] ?? "", technician: "A. Smith", signedBy: "J. Jones", idCard: "", signature: null, logs: [{ date: "18/10/2026", in: "08:30", out: "11:00", travel: 0.5, total: 5, techs: "AS, JJ", count: 2 }], parts: [{ desc: "Guide assembly", unit: "pcs", qty: 4 }], notes: samples["notes"] ?? "", terms: null, template }}/>;
  return <article style={documentVariables(template)} data-style={template.stylePreset} className={`document-paper ${mode === "form" ? "document-form" : ""} mx-auto w-full max-w-lg space-y-4 border p-5 text-xs`}>
    <header className="document-header flex items-start justify-between gap-3 pb-4"><div className="flex items-center gap-2">{logo && <img alt="Company logo" src={logo} className="h-10 max-w-24 object-contain" />}<strong className="text-base">Your Company</strong></div><div className="text-right">Job sheet 1042<br />18/10/2026</div></header>
    {template.header && <p>{template.header}</p>}
    {visibleBlocks(template).map((key) => <section key={key} className="space-y-1"><h3 className="document-label text-[10px] font-semibold uppercase">{documentLabel(template, key)}</h3><p className={mode === "form" ? "border px-3 py-2" : ""}>{samples[key]}</p></section>)}
    {template.footer && <footer className="border-t pt-3 text-center">{template.footer}</footer>}
  </article>;
}