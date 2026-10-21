/** Proposal builder (qs_pricing): equipment specification sections, commercial terms and totals. */
import { lineTotal } from "./price-list";

export type SpecField = { key: string; label: string; options?: string[] };
export type SpecSection = { key: string; title: string; fields: SpecField[]; when?: (spec: Spec) => boolean };
export type Spec = Record<string, string> & { scope?: string; equipment_type?: string; equipment_subtype?: string; equipment_other?: string };

export const EQUIPMENT_TYPES: Record<string, string[]> = {
  "Passenger lift": ["Electric MR", "Electric MRL", "Hydraulic"],
  "Home lift": [],
  "Goods lift": ["4 post", "Scissor lift", "Other"],
  "Escalator": [],
  "Other": [],
};
export const SCOPES = ["New lift", "Modernisation", "Replacement", "New HVAC system", "New installation", "Other"];

const f = (key: string, label: string, options?: string[]): SpecField => ({ key, label, options });
const notes = (s: string) => f(`${s}_notes`, "Notes");
const hydraulic = (s: Spec) => s.equipment_subtype === "Hydraulic";

/** Lift specification, shown in this order on the proposal. Empty fields are left off the PDF. */
export const LIFT_SECTIONS: SpecSection[] = [
  { key: "technical", title: "Technical data", fields: [f("standard", "Lift standard"), f("capacity", "Load capacity"), f("speed", "Speed"), f("stops", "Number of stops"), f("landing_doors", "Landing doors"), f("car_access", "Car accesses"), f("headroom", "Headroom"), f("travel", "Travel"), f("pit", "Pit"), f("shaft_width", "Shaft width"), f("shaft_depth", "Shaft depth"), f("supply_voltage", "Lift supply voltage"), f("lighting_voltage", "Lighting supply voltage"), f("machine_room", "Machine room location"), notes("technical")] },
  { key: "drive", title: "Drive equipment", when: (s) => !hydraulic(s), fields: [f("motor_unit", "Motor unit"), f("roping", "Roping"), f("drive_type", "Type of drive"), f("a3", "A3", ["Compliant", "Not compliant"]), notes("drive")] },
  { key: "hydraulic", title: "Hydraulic equipment", when: hydraulic, fields: [f("power_unit", "Power unit"), f("cylinder", "Cylinder / ram"), f("valve", "Valve block"), notes("hydraulic")] },
  { key: "mechanical", title: "Mechanical", fields: [f("chassis", "Type of chassis"), f("car_guides", "Car guides & brackets"), f("cwt_guides", "Counterweight guides & brackets"), f("wire_rope", "Wire rope"), f("governor", "Overspeed governor"), f("counterweight", "Counterweight"), f("safety_gear", "Safety gear type"), notes("mechanical")] },
  { key: "electrical", title: "Electrical", fields: [f("panel", "Electrical panel"), f("starting", "Starting type"), f("evacuation", "Emergency evacuation"), f("alarm", "Alarm"), f("safety", "Safety"), notes("electrical")] },
  { key: "car", title: "Car", fields: [f("car_dimensions", "Internal dimensions"), f("car_model", "Car model"), f("car_finishes", "Finishes"), f("flooring", "Flooring"), f("mirror", "Mirror"), f("handrail", "Handrail"), f("car_emergency", "Emergency"), notes("car")] },
  { key: "car_doors", title: "Car doors", fields: [f("cd_size", "Clear opening × height"), f("cd_type", "Type of door"), f("cd_panel", "Panel finish"), f("cd_sill", "Sill"), notes("car_doors")] },
  { key: "landing_doors", title: "Landing doors", fields: [f("ld_size", "Clear opening × height"), f("ld_type", "Type"), f("ld_panel", "Panel finish"), f("ld_frame", "Frame finish"), f("ld_frame_provided", "Frame provided", ["Yes", "No"]), f("ld_sill", "Sill"), notes("landing_doors")] },
  { key: "cop", title: "Car operating panel (COP)", fields: [f("cop_type", "Type of control panel"), f("cop_buttons", "Push buttons"), notes("cop")] },
  { key: "lop", title: "Landing operating panel (LOP)", fields: [f("lop_type", "Type"), f("lop_material", "Material"), f("lop_buttons", "Push buttons"), f("lop_display", "Displays on floors (which floors)"), notes("lop")] },
];

export function visibleSections(spec: Spec, trade: string) {
  return trade === "elevator" ? LIFT_SECTIONS.filter((s) => !s.when || s.when(spec)) : [];
}

export type Line = { id: string; item_id?: string | null; category: string; name: string; method?: string; unit: string; quantity: number; rate: number; vat: number; optional?: boolean };
export type Terms = {
  payment: string[]; others: string; warranty_years: string; warranty_cover: string; warranty_notes: string;
  client_items: string[]; exclusions: string[]; delivery: string; delivery_notes: string; notes: string;
  offer_net: string; offer_vat: string;
};

export const DEFAULT_TERMS: Terms = {
  payment: ["40% on signing of the contract", "40% on delivery of material to site", "15% on completion of installation", "5% on handover / certification"],
  others: "",
  warranty_years: "1", warranty_cover: "Parts and labour",
  warranty_notes: "Guarantee is subject to a maintenance agreement being signed within 4 weeks of the lift starting operation.",
  client_items: ["Three-phase power supply to the machine room / controller", "Lighting supply", "Builder's works"],
  exclusions: ["Crane hire to hoist material into the shaft", "Dismantling of existing lift"],
  delivery: "12–16 weeks",
  delivery_notes: "Factory and shipping closures in August and December may extend delivery.",
  notes: "",
  offer_net: "", offer_vat: "18",
};

export function parseTerms(v: unknown): Terms {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Terms>;
  const t = { ...DEFAULT_TERMS, ...o };
  const pay = Array.isArray(o.payment) ? o.payment.map(String) : DEFAULT_TERMS.payment;
  return { ...t, payment: [0, 1, 2, 3].map((i) => pay[i] ?? ""), client_items: Array.isArray(o.client_items) ? o.client_items : t.client_items, exclusions: Array.isArray(o.exclusions) ? o.exclusions : t.exclusions };
}

/** Main offer = lift price (if entered) + non-optional lines; optional lines are priced separately as alternatives. */
export function proposalTotals(lines: Line[], terms: Pick<Terms, "offer_net" | "offer_vat">) {
  const base = Number(terms.offer_net || 0);
  const baseVat = lineTotal(1, base, Number(terms.offer_vat || 0));
  const main = lines.filter((l) => !l.optional).map((l) => lineTotal(l.quantity, l.rate, l.vat));
  const r = (n: number) => Math.round(n * 100) / 100;
  const net = r(baseVat.net + main.reduce((a, b) => a + b.net, 0));
  const vat = r(baseVat.vat + main.reduce((a, b) => a + b.vat, 0));
  return { net, vat, total: r(net + vat) };
}
