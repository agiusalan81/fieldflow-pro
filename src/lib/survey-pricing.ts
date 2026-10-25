/** Universal price generator: internal costs + margin produce a client total; internal figures never reach the client view. */
export type PricingLine = { label: string; amount: number };
export type Pricing = {
  base: PricingLine[];      // supplier / materials base cost
  logistics: PricingLine[]; // freight, clearance, transport
  site: PricingLine[];      // crane, scaffold, skip
  labour: { label: string; people: number; hours: number; rate: number }[];
  contingencyPct: number;
  marginPct: number;        // margin on selling price (0–90)
  vatPct: number;
  clientDescription: string;
};
export const emptyPricing = (): Pricing => ({ base: [], logistics: [], site: [], labour: [], contingencyPct: 0, marginPct: 25, vatPct: 18, clientDescription: '' });

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (l: PricingLine[]) => l.reduce((a, x) => a + n(x.amount), 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function parsePricing(raw: unknown): Pricing {
  const p = { ...emptyPricing(), ...(raw && typeof raw === 'object' ? raw as Partial<Pricing> : {}) };
  return { ...p, base: p.base ?? [], logistics: p.logistics ?? [], site: p.site ?? [], labour: p.labour ?? [] };
}

export function pricingTotals(p: Pricing) {
  const labour = p.labour.reduce((a, l) => a + n(l.people) * n(l.hours) * n(l.rate), 0);
  const cost = sum(p.base) + sum(p.logistics) + sum(p.site) + labour;
  const contingency = cost * Math.max(0, n(p.contingencyPct)) / 100;
  const costWithContingency = cost + contingency;
  const margin = Math.min(90, Math.max(0, n(p.marginPct)));
  const net = costWithContingency / (1 - margin / 100);
  const vat = net * Math.max(0, n(p.vatPct)) / 100;
  return { labour: r2(labour), cost: r2(cost), contingency: r2(contingency), profit: r2(net - costWithContingency), net: r2(net), vat: r2(vat), gross: r2(net + vat) };
}

/** Only client-safe fields: description and totals, no supplier names or internal costs. */
export function clientEstimateView(p: Pricing) {
  const t = pricingTotals(p);
  return { description: p.clientDescription, net: t.net, vatPct: n(p.vatPct), vat: t.vat, gross: t.gross };
}

/** Zoho sync defaults from the work track; an explicit per-survey choice wins. */
export function zohoSyncFor(track: 'direct' | 'supplier_rfq', rules: { direct: boolean; supplier: boolean }, override?: boolean | null) {
  if (typeof override === 'boolean') return override;
  return track === 'direct' ? rules.direct : rules.supplier;
}
