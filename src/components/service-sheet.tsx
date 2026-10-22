import { documentLabel, visibleBlocks } from "@/lib/documents";
import type { PdfSheetData } from "@/lib/service-sheet";
import type { CSSProperties } from "react";
import { useEffect } from "react";
import { documentFontFamily, layerStyle, loadDocumentFont } from "@/lib/branding-assets";

export function ServiceSheet({ data: d }: { data: PdfSheetData }) {
  const t = d.template;
  useEffect(() => { let active = true; let dispose: (() => unknown) | undefined; void loadDocumentFont(t).then(fn => { if (active) dispose = fn; else fn?.(); }).catch(() => {}); return () => { active = false; dispose?.(); }; }, [t.documentFont, t.fontData]);
  const visible = visibleBlocks(t);
  const style = { "--document-primary": t.primaryColor, "--document-accent": t.accentColor, "--document-font": documentFontFamily(t), "--document-field-background": t.fieldBackground, "--document-field-text": t.fieldText, "--document-background-image": t.backgroundData ? `url("${t.backgroundData}")` : "none" } as CSSProperties;
  const text: Record<string, string> = { client: d.client, address: d.address, equipment: d.asset, fault: d.fault, work: d.repairs, notes: d.notes ?? "" };
  const section = (key: string) => <section key={key} className="service-section"><h3 className="document-label mb-1 uppercase" style={layerStyle(t, "label")}>{documentLabel(t, key)}</h3><p className="whitespace-pre-wrap break-words" style={layerStyle(t, "detail")}>{text[key] || "—"}</p>{key === "equipment" && d.workType && <p className="mt-2">{d.workType}</p>}</section>;
  return <article style={style} data-frame={t.frame} data-style="service" className="document-paper service-sheet mx-auto w-full border p-5 text-xs leading-relaxed sm:p-7">
    <header className="document-header service-header"><div><p className="text-base" style={layerStyle(t, "company")}>{d.company}</p><p className="whitespace-pre-wrap">{d.officeAddress}</p>{d.vatNumber && <p>VAT / Tax: {d.vatNumber}</p>}</div><div className="flex items-center justify-center">{d.logo && <img src={d.logo} alt="Company logo" className="max-h-16 max-w-full object-contain"/>}</div><div className="whitespace-pre-wrap break-words text-right">{d.contact}</div></header>
    <div className="my-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2"><h2 className="font-semibold">Job sheet- {d.number}</h2><p>{d.date}</p></div>
    {t.header && <p className="mb-3 whitespace-pre-wrap">{t.header}</p>}
    <div className="service-details">{visible.filter((key) => ["client", "address", "equipment"].includes(key)).map(section)}</div>
    <div className="space-y-3">{visible.filter((key) => !["client", "address", "equipment"].includes(key)).map((key) => {
      if (key === "notes" && !d.notes) return null;
      if (key === "timesheet") return <section key={key}><h3 className="document-label mb-1 uppercase" style={layerStyle(t, "label")}>{documentLabel(t, key)}</h3><div className="overflow-x-auto"><table className="service-table"><thead><tr><th>Date</th><th>In</th><th>Out</th>{t.showTravel && <th>Travel h</th>}<th>Techs</th><th>Hours</th></tr></thead><tbody>{d.logs.map((l, i) => <tr key={i}><td>{l.date}</td><td>{l.in}</td><td>{l.out}</td>{t.showTravel && <td>{l.travel.toFixed(2)}</td>}<td>{l.count} · {l.techs}</td><td>{l.total.toFixed(2)}</td></tr>)}</tbody></table></div></section>;
      if (key === "parts") return <section key={key}><h3 className="document-label mb-1 uppercase" style={layerStyle(t, "label")}>{documentLabel(t, key)}</h3><table className="service-table"><thead><tr><th>Description</th><th>Unit</th><th>Qty</th></tr></thead><tbody>{d.parts.map((p, i) => <tr key={i}><td>{p.desc}</td><td>{p.unit}</td><td>{p.qty}</td></tr>)}</tbody></table></section>;
      if (key === "signoff") return <section key={key} className="service-signatures"><div><h3 className="document-label font-semibold uppercase">{documentLabel(t, "technician")}</h3><p>{d.technician || "—"}</p>{d.technicianSignature && <img src={d.technicianSignature} alt="Technician signature" className="h-16 max-w-full object-contain"/>}</div><div><h3 className="document-label font-semibold uppercase">{documentLabel(t, "client_name")}</h3><p>{d.signedBy || "—"}{d.idCard && ` · ID ${d.idCard}`}</p>{d.signature && <img src={d.signature} alt="Client signature" className="h-16 max-w-full object-contain"/>}</div></section>;
      return section(key);
    })}</div>
    {d.terms && <section className="mt-4 text-[10px]"><h3 className="document-label font-semibold uppercase">Terms & conditions</h3><ul className="list-disc space-y-1 pl-4">{d.terms.split("\n").filter((line) => line.trim()).map((line, i) => <li key={i}>{line.replace(/^\s*[-•]\s*/, "")}</li>)}</ul></section>}
    {t.footer && <footer className="mt-4 border-t pt-2 text-center">{t.footer}</footer>}
  </article>;
}