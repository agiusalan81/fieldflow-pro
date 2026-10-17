/** Billing rules: which rates apply to a job sheet and how its invoice draft is priced. */
export type Rates = { standard: number; ot15: number; ot20: number; callout: number };
export type Hours = { standard: number; ot15: number; ot20: number };
export type PriceSource = "estimate" | "contract" | "client" | "company";
export type Line = { description: string; qty: number; unit_price: number; kind: "labour" | "parts" | "fixed" | "extra" | "callout" };

export const ZERO_RATES: Rates = { standard: 0, ot15: 0, ot20: 0, callout: 0 };

export function parseRates(v: unknown): Rates | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (k: string) => (Number.isFinite(Number(o[k])) ? Math.max(0, Number(o[k])) : 0);
  return { standard: n("standard"), ot15: n("ot15"), ot20: n("ot20"), callout: n("callout") };
}

/** Priority: approved fixed estimate > maintenance contract > client rate card > company default. */
export function pickSource(o: { estimate: boolean; contract: boolean; clientRates: boolean }): PriceSource {
  if (o.estimate) return "estimate";
  if (o.contract) return "contract";
  if (o.clientRates) return "client";
  return "company";
}

/** Contracts discount the client's own rate card if it has one, otherwise the company rates. */
export function ratesFor(source: PriceSource, company: Rates, client: Rates | null): Rates {
  if (source === "client" || source === "contract") return client ?? company;
  return company;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function labourLines(h: Hours, r: Rates, discountPct = 0, callout = false): Line[] {
  const f = 1 - Math.min(100, Math.max(0, discountPct)) / 100;
  const out: Line[] = [];
  if (h.standard) out.push({ description: "Labour – standard (1.0×)", qty: h.standard, unit_price: r2(r.standard * f), kind: "labour" });
  if (h.ot15) out.push({ description: "Labour – overtime (1.5×)", qty: h.ot15, unit_price: r2(r.ot15 * f), kind: "labour" });
  if (h.ot20) out.push({ description: "Labour – overtime (2.0×)", qty: h.ot20, unit_price: r2(r.ot20 * f), kind: "labour" });
  if (callout && r.callout) out.push({ description: "Call-out fee", qty: 1, unit_price: r2(r.callout * f), kind: "callout" });
  return out;
}

/** Draft invoice lines. With a fixed estimate the agreed price replaces labour; actual hours are only shown for audit. */
export function draftLines(o: {
  source: PriceSource; hours: Hours; company: Rates; client: Rates | null; contractDiscountPct?: number;
  estimate?: { title: string; price: number; fixedLabor: boolean } | null; callout?: boolean;
}): Line[] {
  if (o.source === "estimate" && o.estimate) {
    const fixed: Line = { description: `Fixed price – ${o.estimate.title}`, qty: 1, unit_price: r2(o.estimate.price), kind: "fixed" };
    if (o.estimate.fixedLabor) return [fixed];
    return [fixed, ...labourLines(o.hours, o.client ?? o.company)];
  }
  const discount = o.source === "contract" ? o.contractDiscountPct ?? 0 : 0;
  return labourLines(o.hours, ratesFor(o.source, o.company, o.client), discount, o.callout);
}

export const lineTotal = (l: Line) => r2(l.qty * l.unit_price);
export const linesTotal = (ls: Line[]) => r2(ls.reduce((s, l) => s + lineTotal(l), 0));
