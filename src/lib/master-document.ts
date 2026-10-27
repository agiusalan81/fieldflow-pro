import { BILLING_CYCLES, checklistRows, commercialPriceLines, commercialTotal, extrasFor, hasCommercial, stepPrice, parseCommercial, parseExtras, specShows, specChoices } from "./document-blocks";
import { stripRich } from "./rich-text";
import { parseSections, sectionsFor, type Audience } from "./document-audience";

export type MasterDocumentContent = { name: string; trade?: string; body: string; kind: string; items: string[]; sections?: unknown; field_specs?: unknown; commercial?: unknown; extras?: unknown };

/** Shared audience-safe text projection for downloadable master copies. */
export function masterDocumentLines(doc: MasterDocumentContent, view: Audience): string[] {
  const lines = [doc.name, [doc.trade, view === "client" ? "Client copy" : "Technician copy"].filter(Boolean).join(" · "), doc.body];
  for (const section of sectionsFor(parseSections(doc.sections), view)) lines.push(section.title, section.body);
  if (doc.kind === "checklist") for (const row of checklistRows(doc.items, doc.field_specs).filter(row => row.item.trim() && specShows(row.spec, view))) {
    const item = stripRich(row.item), price = stepPrice(row.spec);
    lines.push(view === "client" ? `• ${item}${price ? `   ${price}` : ""}` : `${item}   ${row.spec.control === "reading" ? `________ ${row.spec.unit}` : row.spec.control === "passfail" ? "Pass / Fail / N/A" : row.spec.control === "choice" ? specChoices(row.spec).join(" / ") : "[   ]"}${row.spec.photo ? "   [Photo]" : ""}`);
  }
  if (view === "technician") lines.push("Technician notes & observations", "______________________________________________________________\n______________________________________________________________\n______________________________________________________________", "Unticked steps are reported as N/A.");
  for (const extra of extrasFor(parseExtras(doc.extras), view)) lines.push(`${extra.label}: ${extra.value}`);
  const c = parseCommercial(doc.commercial);
  if (view === "client" && c.showOnClient && hasCommercial(c)) {
    lines.push("Service summary");
    if (c.tierValues.length > 1) {
      for (const t of c.tierValues) {
        const parts = [t.visitsPerYear !== null ? `${t.visitsPerYear} visits per year` : "", t.basePrice !== null ? `€${t.basePrice.toFixed(2)}` : "", t.labourDiscountPct ? `${t.labourDiscountPct}% labour discount` : "", t.partsDiscountPct ? `${t.partsDiscountPct}% parts discount` : ""].filter(Boolean);
        lines.push(`${t.name || "Tier"}: ${parts.join(" · ")}`);
      }
    } else if (c.visitsPerYear !== null) lines.push(`${c.visitsPerYear} visits per year`);
    const total = commercialTotal(c), p = c.liftPricing;
    const money = (n: number) => `€${n.toFixed(2)}`;
    if (p) lines.push(`${p.stops} stops · ${p.landingDoors} landing doors · ${p.carAccess} car access`);
    if (p && c.clientPriceDisplay === "itemised") for (const line of commercialPriceLines(c).filter(line => line.key === "base" || line.quantity > 0)) lines.push(`${line.label}: ${line.quantity} × ${money(line.rate)} = ${money(line.amount)}`);
    if (p && c.showSampleCalculation) {
      lines.push("Base rates & sample calculation", `Base price: ${money(c.basePrice ?? 0)}; includes ${p.includedStops} stops, ${p.includedLandingDoors} landing doors and 1 car access`, `Additional stop: ${money(p.extraStopRate)}; additional landing door: ${money(p.landingDoorRate)}; extra cabin door: ${money(p.extraCarDoorRate)}`, `${commercialPriceLines(c).map(line => `${line.quantity} × ${money(line.rate)}`).join(" + ")} = ${money(total ?? 0)}`);
    }
    if (total !== null) lines.push(`Total: ${money(total)} ${BILLING_CYCLES.find(cycle => cycle.key === c.billingCycle)?.label.toLowerCase()}`);
    if (c.labourDiscountPct) lines.push(`Labour discount: ${c.labourDiscountPct}%`);
    if (c.partsDiscountPct) lines.push(`Parts discount: ${c.partsDiscountPct}%`);
    if (c.summaryItems.length) { for (const i of c.summaryItems) lines.push(`• ${i.tag ? `[${i.tag}] ` : ""}${i.text}`); }
    if (c.terms.trim()) lines.push(c.terms);
  }
  return lines.filter(line => line.trim());
}