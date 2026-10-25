/** Parameter blocks for reusable master documents: digitised checklist controls, commercial terms and trade extras. */

export type BlockAudience = "both" | "technician" | "client";

export type FieldControl = "checkbox" | "passfail" | "reading";
export const FIELD_CONTROLS: { key: FieldControl; label: string }[] = [
  { key: "checkbox", label: "Checkbox" },
  { key: "passfail", label: "Pass / Fail / N/A" },
  { key: "reading", label: "Numeric reading" },
];

export type FieldSpec = { control: FieldControl; audience: BlockAudience; unit: string };
export const DEFAULT_SPEC: FieldSpec = { control: "checkbox", audience: "technician", unit: "" };

/** Keep descriptions and their controls paired through every row operation. */
export function checklistRows(items: string[], raw: unknown) {
  const specs = parseFieldSpecs(raw, items.length);
  return items.map((item, i) => ({ item, spec: specs[i] ?? { ...DEFAULT_SPEC } }));
}

export function moveChecklistRow<T>(rows: T[], index: number, destination: number): T[] {
  if (index < 0 || destination < 0 || index >= rows.length || destination >= rows.length) return rows;
  const next = [...rows];
  const [row] = next.splice(index, 1);
  if (row === undefined) return rows;
  next.splice(destination, 0, row);
  return next;
}

const isControl = (v: unknown): v is FieldControl => FIELD_CONTROLS.some((c) => c.key === v);
const isAudience = (v: unknown): v is BlockAudience => v === "both" || v === "technician" || v === "client";

/** Reads stored per-item specs, filling defaults so every checklist item always has a control. */
export function parseFieldSpecs(raw: unknown, itemCount: number): FieldSpec[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: itemCount }, (_, i) => {
    const r = arr[i] && typeof arr[i] === "object" ? arr[i] as Partial<FieldSpec> : {};
    return {
      control: isControl(r.control) ? r.control : DEFAULT_SPEC.control,
      audience: isAudience(r.audience) ? r.audience : DEFAULT_SPEC.audience,
      unit: typeof r.unit === "string" ? r.unit.slice(0, 20) : "",
    };
  });
}

/** Whether a checklist item prints on the given copy. */
export function specShows(spec: FieldSpec, view: "technician" | "client"): boolean {
  return spec.audience === "both" || spec.audience === view;
}

export type BillingCycle = "one_off" | "monthly" | "quarterly" | "annually";
export const BILLING_CYCLES: { key: BillingCycle; label: string }[] = [
  { key: "one_off", label: "One-off" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "annually", label: "Annually" },
];

export type Commercial = {
  liftPricing: LiftPricing | null;
  clientPriceDisplay: "compound" | "itemised";
  visitsPerYear: number | null;
  basePrice: number | null;
  billingCycle: BillingCycle;
  labourDiscountPct: number;
  partsDiscountPct: number;
  terms: string;
  /** Print the price summary on the client copy; technicians never see it. */
  showOnClient: boolean;
};
export const DEFAULT_COMMERCIAL: Commercial = {
  liftPricing: null, clientPriceDisplay: "compound",
  visitsPerYear: null, basePrice: null, billingCycle: "annually",
  labourDiscountPct: 0, partsDiscountPct: 0, terms: "", showOnClient: true,
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const pct = (v: unknown): number => Math.min(100, Math.max(0, num(v) ?? 0));

export type LiftPricing = {
  stops: number; includedStops: number; extraStopRate: number;
  landingDoors: number; includedLandingDoors: number; landingDoorRate: number;
  carAccess: 1 | 2 | 3; extraCarDoorRate: number;
};
export const DEFAULT_LIFT_PRICING: LiftPricing = {
  stops: 2, includedStops: 2, extraStopRate: 0,
  landingDoors: 2, includedLandingDoors: 0, landingDoorRate: 0,
  carAccess: 1, extraCarDoorRate: 0,
};
export function parseLiftPricing(raw: unknown): LiftPricing | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const count = (key: keyof LiftPricing) => Math.floor(num(r[key]) ?? DEFAULT_LIFT_PRICING[key]);
  return {
    stops: count("stops"), includedStops: count("includedStops"), extraStopRate: num(r.extraStopRate) ?? 0,
    landingDoors: count("landingDoors"), includedLandingDoors: count("includedLandingDoors"), landingDoorRate: num(r.landingDoorRate) ?? 0,
    carAccess: r.carAccess === 2 || r.carAccess === 3 ? r.carAccess : 1, extraCarDoorRate: num(r.extraCarDoorRate) ?? 0,
  };
}
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function commercialPriceLines(c: Commercial) {
  const lines = [{ key: "base", label: "Base service", quantity: 1, rate: c.basePrice ?? 0, amount: c.basePrice ?? 0 }];
  if (c.liftPricing) {
    const p = c.liftPricing;
    lines[0].label = `Base service (includes ${p.includedStops} stops and 1 car access${p.includedLandingDoors ? `, ${p.includedLandingDoors} landing doors` : ""})`;
    lines.push(
      { key: "stops", label: `Additional stops (${p.stops} total stops)`, quantity: Math.max(0, p.stops - p.includedStops), rate: p.extraStopRate, amount: 0 },
      { key: "landing", label: `Landing doors (${p.landingDoors} landing doors)`, quantity: Math.max(0, p.landingDoors - p.includedLandingDoors), rate: p.landingDoorRate, amount: 0 },
      { key: "car", label: `Extra cabin doors (${p.carAccess} car access)`, quantity: p.carAccess - 1, rate: p.extraCarDoorRate, amount: 0 },
    );
  }
  return lines.map(line => ({ ...line, amount: money(line.quantity * line.rate) }));
}
export function commercialTotal(c: Commercial): number | null {
  if (c.basePrice === null && !c.liftPricing) return null;
  return money(commercialPriceLines(c).reduce((sum, line) => sum + line.amount, 0));
}

export function parseCommercial(raw: unknown): Commercial {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    liftPricing: parseLiftPricing(r["liftPricing"]),
    clientPriceDisplay: r["clientPriceDisplay"] === "itemised" ? "itemised" : "compound",
    visitsPerYear: num(r["visitsPerYear"]),
    basePrice: num(r["basePrice"]),
    billingCycle: BILLING_CYCLES.some((c) => c.key === r["billingCycle"]) ? r["billingCycle"] as BillingCycle : "annually",
    labourDiscountPct: pct(r["labourDiscountPct"]),
    partsDiscountPct: pct(r["partsDiscountPct"]),
    terms: typeof r["terms"] === "string" ? r["terms"] : "",
    showOnClient: r["showOnClient"] !== false,
  };
}

/** True when the document carries any commercial content worth printing. */
export function hasCommercial(c: Commercial): boolean {
  return c.liftPricing !== null || c.basePrice !== null || c.visitsPerYear !== null || c.labourDiscountPct > 0 || c.partsDiscountPct > 0 || !!c.terms.trim();
}

export type Extra = { label: string; value: string; audience: BlockAudience };
export function parseExtras(raw: unknown): Extra[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const r = e as Partial<Extra>;
    return [{
      label: typeof r.label === "string" ? r.label.slice(0, 60) : "",
      value: typeof r.value === "string" ? r.value : "",
      audience: isAudience(r.audience) ? r.audience : "both" as BlockAudience,
    }];
  }).filter((e) => e.label.trim() || e.value.trim());
}

export function extrasFor(extras: Extra[], view: "technician" | "client"): Extra[] {
  return extras.filter((e) => e.audience === "both" || e.audience === view);
}
