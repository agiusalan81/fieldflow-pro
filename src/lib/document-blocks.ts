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
  visitsPerYear: null, basePrice: null, billingCycle: "annually",
  labourDiscountPct: 0, partsDiscountPct: 0, terms: "", showOnClient: true,
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const pct = (v: unknown): number => Math.min(100, Math.max(0, num(v) ?? 0));

export function parseCommercial(raw: unknown): Commercial {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    visitsPerYear: num(r.visitsPerYear),
    basePrice: num(r.basePrice),
    billingCycle: BILLING_CYCLES.some((c) => c.key === r.billingCycle) ? r.billingCycle as BillingCycle : "annually",
    labourDiscountPct: pct(r.labourDiscountPct),
    partsDiscountPct: pct(r.partsDiscountPct),
    terms: typeof r.terms === "string" ? r.terms : "",
    showOnClient: r.showOnClient !== false,
  };
}

/** True when the document carries any commercial content worth printing. */
export function hasCommercial(c: Commercial): boolean {
  return c.basePrice !== null || c.visitsPerYear !== null || c.labourDiscountPct > 0 || c.partsDiscountPct > 0 || !!c.terms.trim();
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
