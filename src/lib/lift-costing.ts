/** Lift costing sheet engine (Lifts & Escalators pack, tenant-only).
 * Supplier costs + wages + markups -> client price; margin comparison and client-facing line mapping.
 * Supplier names, raw costs and margins NEVER appear in client-facing output. */

export type ThirdPartyCost = { label: string; amount: number };
export type StagePayment = { label: string; pct: number };

export type CostingDraft = {
  id: string;
  isNew: boolean;
  title: string;
  survey_id: string | null;
  rfq_id: string | null;
  quote_id: string | null;
  equipment_cost: number;
  freight_cost: number;
  customs_cost: number;
  dismantling_cost: number;
  third_party: ThirdPartyCost[];
  mechanical_hours: number;
  mechanical_rate: number;
  electrical_hours: number;
  electrical_rate: number;
  certification_cost: number;
  equipment_markup_pct: number;
  labour_markup_pct: number;
  subcontractor_markup_pct: number;
  contingency_pct: number;
  stages: StagePayment[];
  status: string;
};

export const emptyCosting = (): CostingDraft => ({
  id: crypto.randomUUID(), isNew: true, title: "", survey_id: null, rfq_id: null, quote_id: null,
  equipment_cost: 0, freight_cost: 0, customs_cost: 0, dismantling_cost: 0, third_party: [],
  mechanical_hours: 0, mechanical_rate: 0, electrical_hours: 0, electrical_rate: 0, certification_cost: 0,
  equipment_markup_pct: 25, labour_markup_pct: 25, subcontractor_markup_pct: 15, contingency_pct: 5,
  stages: [], status: "draft",
});

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Normalises a lift_costing_sheets row (or null) into an editable draft. */
export function normalizeCosting(row: Record<string, unknown> | null | undefined): CostingDraft {
  const tp = row?.["third_party_costs"];
  const st = row?.["stage_payments"];
  return {
    ...emptyCosting(),
    id: String(row?.["id"] ?? crypto.randomUUID()),
    isNew: !row?.["id"],
    title: String(row?.["title"] ?? ""),
    survey_id: (row?.["survey_id"] as string | null | undefined) ?? null,
    rfq_id: (row?.["rfq_id"] as string | null | undefined) ?? null,
    quote_id: (row?.["quote_id"] as string | null | undefined) ?? null,
    equipment_cost: num(row?.["equipment_cost"]),
    freight_cost: num(row?.["freight_cost"]),
    customs_cost: num(row?.["customs_cost"]),
    dismantling_cost: num(row?.["dismantling_cost"]),
    third_party: Array.isArray(tp) ? tp.filter((t) => t && typeof t === "object").map((t) => ({ label: String((t as Record<string, unknown>)["label"] ?? ""), amount: num((t as Record<string, unknown>)["amount"]) })) : [],
    mechanical_hours: num(row?.["mechanical_hours"]),
    mechanical_rate: num(row?.["mechanical_rate"]),
    electrical_hours: num(row?.["electrical_hours"]),
    electrical_rate: num(row?.["electrical_rate"]),
    certification_cost: num(row?.["certification_cost"]),
    equipment_markup_pct: num(row?.["equipment_markup_pct"]) || 25,
    labour_markup_pct: num(row?.["labour_markup_pct"]) || 25,
    subcontractor_markup_pct: num(row?.["subcontractor_markup_pct"]) || 15,
    contingency_pct: num(row?.["contingency_pct"]) || 5,
    stages: Array.isArray(st) ? st.filter((s) => s && typeof s === "object").map((s) => ({ label: String((s as Record<string, unknown>)["label"] ?? ""), pct: num((s as Record<string, unknown>)["pct"]) })) : [],
    status: String(row?.["status"] ?? "draft"),
  };
}

export type CostBreakdown = {
  supply: number; labour: number; thirdParty: number; dismantling: number; certification: number; total: number;
};

/** Raw internal cost breakdown (what the company pays). */
export function costBreakdown(d: CostingDraft): CostBreakdown {
  const supply = round(d.equipment_cost + d.freight_cost + d.customs_cost);
  const labour = round(d.mechanical_hours * d.mechanical_rate + d.electrical_hours * d.electrical_rate);
  const thirdParty = round(d.third_party.reduce((s, t) => s + t.amount, 0));
  const total = round(supply + labour + thirdParty + d.dismantling_cost + d.certification_cost);
  return { supply, labour, thirdParty, dismantling: round(d.dismantling_cost), certification: round(d.certification_cost), total };
}

export type PricedScenario = {
  key: string; label: string;
  equipment_markup_pct: number; labour_markup_pct: number; subcontractor_markup_pct: number;
  price: number; profit: number; margin_pct: number;
};

/** Prices the draft with a given markup set. Contingency applies to the marked-up subtotal. */
export function priceWith(d: CostingDraft, eq: number, lab: number, sub: number): { price: number; profit: number; margin_pct: number } {
  const c = costBreakdown(d);
  const marked = c.supply * (1 + eq / 100) + c.labour * (1 + lab / 100) + (c.thirdParty + c.dismantling + c.certification) * (1 + sub / 100);
  const price = round(marked * (1 + d.contingency_pct / 100));
  const profit = round(price - c.total);
  return { price, profit, margin_pct: price > 0 ? round((profit / price) * 100) : 0 };
}

export const MARGIN_SCENARIOS: { key: string; label: string; eq: number; lab: number; sub: number }[] = [
  { key: "competitive", label: "Competitive", eq: 18, lab: 18, sub: 10 },
  { key: "standard", label: "Standard", eq: 25, lab: 25, sub: 15 },
  { key: "premium", label: "Premium", eq: 32, lab: 32, sub: 20 },
];

/** Side-by-side comparison of the preset margin scenarios plus the current custom markups. */
export function comparisonMatrix(d: CostingDraft): PricedScenario[] {
  const scenarios = MARGIN_SCENARIOS.map((s) => ({ key: s.key, label: s.label, equipment_markup_pct: s.eq, labour_markup_pct: s.lab, subcontractor_markup_pct: s.sub, ...priceWith(d, s.eq, s.lab, s.sub) }));
  scenarios.push({ key: "current", label: "Current markups", equipment_markup_pct: d.equipment_markup_pct, labour_markup_pct: d.labour_markup_pct, subcontractor_markup_pct: d.subcontractor_markup_pct, ...priceWith(d, d.equipment_markup_pct, d.labour_markup_pct, d.subcontractor_markup_pct) });
  return scenarios;
}

export const STAGE_PRESETS: Record<string, StagePayment[]> = {
  new_installation: [
    { label: "Order confirmation", pct: 30 },
    { label: "Equipment delivery to site", pct: 40 },
    { label: "Installation complete", pct: 20 },
    { label: "Testing, certification & handover", pct: 10 },
  ],
  modernisation: [
    { label: "Order confirmation", pct: 40 },
    { label: "Materials on site", pct: 40 },
    { label: "Completion & handover", pct: 20 },
  ],
};

/** Stage amounts in cents-accurate euros; the last stage absorbs rounding so amounts sum to the price. */
export function stageAmounts(price: number, stages: StagePayment[]): { label: string; pct: number; amount: number }[] {
  let used = 0;
  return stages.map((s, i) => {
    const amount = i === stages.length - 1 ? round(price - used) : round((price * s.pct) / 100);
    used = round(used + amount);
    return { ...s, amount };
  });
}

export type ClientLine = { description: string; amount: number };

/** Client-facing proposal lines: marked-up section totals only — never supplier names, raw costs or margins. */
export function clientLines(d: CostingDraft): ClientLine[] {
  const c = costBreakdown(d);
  const eq = 1 + d.equipment_markup_pct / 100;
  const lab = 1 + d.labour_markup_pct / 100;
  const sub = 1 + d.subcontractor_markup_pct / 100;
  const cont = 1 + d.contingency_pct / 100;
  const lines: ClientLine[] = [];
  if (c.supply > 0) lines.push({ description: "Supply & delivery of lift equipment", amount: round(c.supply * eq * cont) });
  if (c.labour > 0) lines.push({ description: "Installation & commissioning labour", amount: round(c.labour * lab * cont) });
  if (c.thirdParty > 0) lines.push({ description: "Site works & services (crane, permits, scaffolding, builder's work)", amount: round(c.thirdParty * sub * cont) });
  if (c.dismantling > 0) lines.push({ description: "Decommissioning, dismantling & safe removal of existing lift", amount: round(c.dismantling * sub * cont) });
  if (c.certification > 0) lines.push({ description: "Testing & statutory certification", amount: round(c.certification * sub * cont) });
  return lines;
}

/** Client lines sum to the full client price (rounding goes to the largest line). */
export function reconcileClientLines(d: CostingDraft): ClientLine[] {
  const lines = clientLines(d);
  const target = priceWith(d, d.equipment_markup_pct, d.labour_markup_pct, d.subcontractor_markup_pct).price;
  const sum = round(lines.reduce((s, l) => s + l.amount, 0));
  const diff = round(target - sum);
  if (diff !== 0 && lines.length) {
    const biggest = lines.reduce((a, b) => (b.amount > a.amount ? b : a));
    biggest.amount = round(biggest.amount + diff);
  }
  return lines;
}
