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
  template_id: string | null;
  equipment_type: string;
  output_style: OutputStyle;
  turnkey_description: string;
  spec_groups: string[];
  specs: Record<string, string>;
  custom_specs: string[];
  inclusions: string[];
  exclusions: string[];
  options: ProposalOption[];
  photos: { id: string; caption: string }[];
  notes: string;
  vat_pct: number;
};

export const emptyCosting = (): CostingDraft => ({
  id: crypto.randomUUID(), isNew: true, title: "", survey_id: null, rfq_id: null, quote_id: null,
  equipment_cost: 0, freight_cost: 0, customs_cost: 0, dismantling_cost: 0, third_party: [],
  mechanical_hours: 0, mechanical_rate: 0, electrical_hours: 0, electrical_rate: 0, certification_cost: 0,
  equipment_markup_pct: 25, labour_markup_pct: 25, subcontractor_markup_pct: 15, contingency_pct: 5,
  stages: [], status: "draft",
  template_id: null, equipment_type: "passenger_lift", output_style: "itemised", turnkey_description: "",
  spec_groups: ["shaft", "entrances", "platform", "drive", "cabin"], specs: {}, custom_specs: [],
  inclusions: [], exclusions: [], options: [], photos: [], notes: "", vat_pct: 18,
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
    ...(row?.["id"] ? readProposalExtras(row) : {}),
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

/* ───────────── Costing & proposal templates (Lift pack) ───────────── */

export const EQUIPMENT_TYPES: { value: string; label: string; groups: SpecGroupKey[] }[] = [
  { value: "passenger_lift", label: "Passenger lift", groups: ["shaft", "entrances", "platform", "drive", "cabin"] },
  { value: "goods_lift", label: "Goods lift", groups: ["shaft", "entrances", "platform", "drive"] },
  { value: "four_post", label: "4-post lift", groups: ["platform", "drive"] },
  { value: "scissor", label: "Scissor lift", groups: ["platform", "drive"] },
  { value: "rotary_scissor", label: "Rotary scissor lift", groups: ["platform", "drive"] },
  { value: "dumbwaiter", label: "Dumbwaiter", groups: ["shaft", "entrances", "platform"] },
  { value: "platform_lift", label: "Platform / home lift", groups: ["shaft", "entrances", "platform", "drive"] },
  { value: "other", label: "Other equipment", groups: ["platform"] },
];
export const equipmentLabel = (v: string) => EQUIPMENT_TYPES.find((e) => e.value === v)?.label ?? v;

export type SpecGroupKey = "shaft" | "entrances" | "platform" | "drive" | "cabin";
export const SPEC_GROUPS: { key: SpecGroupKey; label: string; fields: { key: string; label: string }[] }[] = [
  { key: "shaft", label: "Shaft / well geometry", fields: [
    { key: "shaft_width", label: "Shaft width (mm)" }, { key: "shaft_depth", label: "Shaft depth (mm)" },
    { key: "pit_depth", label: "Pit depth (mm)" }, { key: "headroom", label: "Headroom (mm)" },
    { key: "travel", label: "Travel (mm)" }, { key: "structure", label: "Structure (concrete / steel / free-standing)" }] },
  { key: "entrances", label: "Stops & entrances", fields: [
    { key: "stops", label: "Stops" }, { key: "entrances", label: "Entrances (front / rear / adjacent)" }, { key: "door_type", label: "Landing door type" }] },
  { key: "platform", label: "Load & platform", fields: [
    { key: "capacity", label: "Rated capacity" }, { key: "platform_size", label: "Platform / car size (W × D × H)" }, { key: "speed", label: "Speed (m/s)" }] },
  { key: "drive", label: "Drive & power", fields: [
    { key: "drive_type", label: "Drive type" }, { key: "motor_kw", label: "Motor power (kW)" }, { key: "power_supply", label: "Power supply" }] },
  { key: "cabin", label: "Cabin & finishes", fields: [
    { key: "enclosure", label: "Car enclosure" }, { key: "flooring", label: "Flooring" }, { key: "finishes", label: "Finishes & lighting" }] },
];

export type OutputStyle = "turnkey" | "itemised" | "net_vat_shipping";
export const OUTPUT_STYLES: { value: OutputStyle; label: string; hint: string }[] = [
  { value: "turnkey", label: "One price (turnkey)", hint: "Everything rolled into a single client price — e.g. constant-price suppliers." },
  { value: "itemised", label: "Itemised sections", hint: "Supply, installation, site works, certification as separate lines." },
  { value: "net_vat_shipping", label: "Net + VAT + shipping + options", hint: "Lift net price, VAT, total, shipping inc. VAT shown separately, options, grand total — for variable freight." },
];

export type ProposalOption = { label: string; amount: number; selected: boolean };
export type TemplateDefaults = Partial<Pick<CostingDraft, "equipment_markup_pct" | "labour_markup_pct" | "subcontractor_markup_pct" | "contingency_pct" | "mechanical_hours" | "electrical_hours" | "mechanical_rate" | "electrical_rate" | "vat_pct" | "stages">>;

export type CostingTemplate = {
  id: string; name: string; equipment_type: string; supplier_origin: string; output_style: OutputStyle;
  turnkey_description: string; spec_groups: string[]; custom_specs: string[]; defaults: TemplateDefaults;
  inclusions: string[]; exclusions: string[]; options: ProposalOption[]; notes: string;
};

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? "")).filter((x) => x.trim()) : []);
const optList = (v: unknown): ProposalOption[] => (Array.isArray(v) ? v.filter((o) => o && typeof o === "object").map((o) => { const r = o as Record<string, unknown>; return { label: String(r["label"] ?? ""), amount: num(r["amount"]), selected: r["selected"] === true }; }) : []);
const style = (v: unknown): OutputStyle => (v === "turnkey" || v === "net_vat_shipping" ? v : "itemised");

export function normalizeTemplate(row: Record<string, unknown> | null | undefined): CostingTemplate {
  const def = (row?.["defaults"] && typeof row["defaults"] === "object" ? row["defaults"] : {}) as TemplateDefaults;
  const eq = String(row?.["equipment_type"] ?? "passenger_lift");
  const groups = strList(row?.["spec_groups"]);
  return {
    id: String(row?.["id"] ?? crypto.randomUUID()), name: String(row?.["name"] ?? ""), equipment_type: eq,
    supplier_origin: String(row?.["supplier_origin"] ?? ""), output_style: style(row?.["output_style"]),
    turnkey_description: String(row?.["turnkey_description"] ?? ""),
    spec_groups: groups.length || row?.["id"] ? groups : (EQUIPMENT_TYPES.find((e) => e.value === eq)?.groups ?? []),
    custom_specs: strList(row?.["custom_specs"]), defaults: def,
    inclusions: strList(row?.["inclusions"]), exclusions: strList(row?.["exclusions"]), options: optList(row?.["options"]),
    notes: String(row?.["notes"] ?? ""),
  };
}

/** Applying a template copies its defaults; the sheet stays fully editable afterwards. Costs already entered are kept. */
export function applyTemplate(d: CostingDraft, t: CostingTemplate): CostingDraft {
  const f = t.defaults;
  return {
    ...d, template_id: t.id, equipment_type: t.equipment_type, output_style: t.output_style,
    turnkey_description: t.turnkey_description, spec_groups: [...t.spec_groups], custom_specs: [...t.custom_specs],
    inclusions: [...t.inclusions], exclusions: [...t.exclusions], notes: t.notes,
    options: t.options.map((o) => ({ ...o })),
    equipment_markup_pct: f.equipment_markup_pct ?? d.equipment_markup_pct,
    labour_markup_pct: f.labour_markup_pct ?? d.labour_markup_pct,
    subcontractor_markup_pct: f.subcontractor_markup_pct ?? d.subcontractor_markup_pct,
    contingency_pct: f.contingency_pct ?? d.contingency_pct,
    mechanical_hours: d.mechanical_hours || (f.mechanical_hours ?? 0),
    electrical_hours: d.electrical_hours || (f.electrical_hours ?? 0),
    mechanical_rate: d.mechanical_rate || (f.mechanical_rate ?? 0),
    electrical_rate: d.electrical_rate || (f.electrical_rate ?? 0),
    vat_pct: f.vat_pct ?? d.vat_pct,
    stages: f.stages?.length ? f.stages.map((s) => ({ ...s })) : d.stages,
  };
}

/** Saves the current sheet's setup as template defaults (no costs, no client data). */
export function templateFromDraft(d: CostingDraft, name: string): Omit<CostingTemplate, "id"> {
  return {
    name, equipment_type: d.equipment_type, supplier_origin: "", output_style: d.output_style,
    turnkey_description: d.turnkey_description, spec_groups: [...d.spec_groups], custom_specs: [...d.custom_specs],
    inclusions: [...d.inclusions], exclusions: [...d.exclusions], notes: d.notes,
    options: d.options.map((o) => ({ ...o, selected: false })),
    defaults: {
      equipment_markup_pct: d.equipment_markup_pct, labour_markup_pct: d.labour_markup_pct,
      subcontractor_markup_pct: d.subcontractor_markup_pct, contingency_pct: d.contingency_pct,
      mechanical_hours: d.mechanical_hours, electrical_hours: d.electrical_hours,
      mechanical_rate: d.mechanical_rate, electrical_rate: d.electrical_rate, vat_pct: d.vat_pct, stages: d.stages,
    },
  };
}

export function readProposalExtras(row: Record<string, unknown> | null | undefined) {
  const specs = row?.["specs"] && typeof row["specs"] === "object" && !Array.isArray(row["specs"]) ? Object.fromEntries(Object.entries(row["specs"] as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])) : {};
  const photos = Array.isArray(row?.["photos"]) ? (row!["photos"] as unknown[]).filter((p) => p && typeof p === "object").map((p) => { const r = p as Record<string, unknown>; return { id: String(r["id"] ?? ""), caption: String(r["caption"] ?? "") }; }).filter((p) => /^[0-9a-f-]{36}$/.test(p.id)) : [];
  const vat = Number(row?.["vat_pct"]);
  return {
    template_id: (row?.["template_id"] as string | null | undefined) ?? null,
    equipment_type: String(row?.["equipment_type"] ?? "passenger_lift"),
    output_style: style(row?.["output_style"]),
    turnkey_description: String(row?.["turnkey_description"] ?? ""),
    spec_groups: strList(row?.["spec_groups"]), specs, custom_specs: strList(row?.["custom_specs"]),
    inclusions: strList(row?.["inclusions"]), exclusions: strList(row?.["exclusions"]),
    options: optList(row?.["options"]), photos, notes: String(row?.["notes"] ?? ""),
    vat_pct: Number.isFinite(vat) && vat >= 0 && vat <= 100 ? vat : 18,
  };
}

/** Spec rows that appear on the client proposal: only active groups/custom specs with a value. */
export function specRows(d: CostingDraft): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const g of SPEC_GROUPS) if (d.spec_groups.includes(g.key)) for (const f of g.fields) { const v = (d.specs[f.key] ?? "").trim(); if (v) rows.push({ label: f.label, value: v }); }
  for (const c of d.custom_specs) { const v = (d.specs[`custom:${c}`] ?? "").trim(); if (v) rows.push({ label: c, value: v }); }
  return rows;
}

export type ProposalLine = { description: string; amount: number; kind: "main" | "shipping" | "option" };
export type ProposalSummary = {
  lines: ProposalLine[];
  net: number; vat: number; total: number;
  shippingNet: number; shippingIncVat: number; optionsNet: number;
  grandNet: number; grandVat: number; grandTotal: number;
};

/** Client-facing lines for the chosen output style. Selected options are added on top of the costed price. */
export function proposalSummary(d: CostingDraft): ProposalSummary {
  const cont = 1 + d.contingency_pct / 100;
  const price = priceWith(d, d.equipment_markup_pct, d.labour_markup_pct, d.subcontractor_markup_pct).price;
  const vatR = d.vat_pct / 100;
  const name = d.turnkey_description.trim() || `Supply, delivery, installation and commissioning of ${d.title.trim() || equipmentLabel(d.equipment_type).toLowerCase()}`;
  let lines: ProposalLine[] = [];
  let shippingNet = 0;
  if (d.output_style === "turnkey") {
    if (price > 0) lines = [{ description: name, amount: price, kind: "main" }];
  } else if (d.output_style === "net_vat_shipping") {
    shippingNet = round((d.freight_cost + d.customs_cost) * (1 + d.equipment_markup_pct / 100) * cont);
    const main = round(price - shippingNet);
    if (main > 0) lines.push({ description: `${d.title.trim() || equipmentLabel(d.equipment_type)} — net price`, amount: main, kind: "main" });
    if (shippingNet > 0) lines.push({ description: "Shipping, freight & customs (estimate — varies monthly)", amount: shippingNet, kind: "shipping" });
  } else {
    lines = reconcileClientLines(d).map((l) => ({ ...l, kind: "main" as const }));
  }
  const opts = d.options.filter((o) => o.selected && o.label.trim() && o.amount > 0);
  for (const o of opts) lines.push({ description: `Option: ${o.label.trim()}`, amount: round(o.amount), kind: "option" });
  const optionsNet = round(opts.reduce((s, o) => s + o.amount, 0));
  const net = round(price - shippingNet);
  const vat = round(net * vatR);
  const grandNet = round(price + optionsNet);
  const grandVat = round(grandNet * vatR);
  return {
    lines, net, vat, total: round(net + vat), shippingNet, shippingIncVat: round(shippingNet * (1 + vatR)), optionsNet,
    grandNet, grandVat, grandTotal: round(grandNet + grandVat),
  };
}
