/** Lift RFQ (estimate request) fields, package-supplier option filtering and supplier reminder timing. */
export type SupplierCategory = "doors" | "machines" | "controllers" | "fixtures";
export const SUPPLIER_CATEGORIES: { key: SupplierCategory; label: string }[] = [
  { key: "doors", label: "Doors available" },
  { key: "machines", label: "Machines available" },
  { key: "controllers", label: "Controllers available" },
  { key: "fixtures", label: "Fixtures available" },
];

export type RfqField = { key: string; label: string; type: "select" | "number" | "text"; options?: string[] | undefined; unit?: string | undefined; category?: SupplierCategory | undefined };
export type RfqSection = { title: string; fields: RfqField[] };

const sel = (key: string, label: string, options: string[], category?: SupplierCategory): RfqField => ({ key, label, type: "select", options, category });
const num = (key: string, label: string, unit?: string): RfqField => ({ key, label, type: "number", unit });
const txt = (key: string, label: string): RfqField => ({ key, label, type: "text" });

export const RFQ_SECTIONS: RfqSection[] = [
  { title: "Lift", fields: [
    txt("lift_ref", "Lift reference"), num("lift_qty", "Number of lifts"),
    sel("target_date", "Target date", ["TBA", "Urgent (24–48h)", "Within 1 week", "Within 2 weeks"]),
    sel("lift_type", "Lift type", ["Passenger", "Goods / Passenger", "Service / Stretcher", "Bed / Hospital", "Panoramic / Glass", "Home lift / Platform", "Dumbwaiter"]),
    sel("use", "Building use", ["Residential", "Commercial / Office", "Hotel", "Hospital / Medical", "Industrial / Warehouse", "Public transport"]),
    sel("drive", "Drive", ["Traction MRL gearless", "Traction geared", "Hydraulic 1:1 direct", "Hydraulic 2:1 roped", "Screw & nut"]),
    sel("machine", "Machine", ["Montanari", "Alberto Sassi", "Akış", "Ziehl-Abegg", "Manufacturer standard"], "machines"),
    sel("voltage", "Voltage", ["400V 3-phase 50Hz", "230V 1-phase", "415V 3-phase", "Other"]),
  ] },
  { title: "Shaft", fields: [
    num("stops", "Stops"), sel("load", "Load", ["320 kg", "450 kg", "630 kg", "800 kg", "1000 kg", "1275 kg", "1600 kg", "2000 kg"]),
    num("persons", "Persons"), num("pit", "Pit", "mm"), num("travel", "Travel", "mm"), num("headroom", "Headroom", "mm"),
    num("shaft_w", "Shaft width", "mm"), num("shaft_d", "Shaft depth", "mm"), txt("floor_heights", "Floor-to-floor heights (mm, comma separated)"),
  ] },
  { title: "Landing & car doors", fields: [
    sel("door_brand", "Door brand", ["Wittur", "Fermator", "AHZ", "AHZ Plus", "Selcom", "Sematic", "Prisma", "Meiller"], "doors"),
    sel("door_opening", "Clear opening", ["700 mm", "800 mm", "900 mm", "1000 mm", "1100 mm", "1200 mm"]),
    sel("door_type", "Door type", ["2-panel centre", "2-panel telescopic", "3-panel telescopic", "4-panel centre", "Single swing"]),
    sel("door_hand", "Opening hand", ["Central", "Left", "Right"]),
    sel("door_material", "Door finish", ["Stainless 304", "Stainless 316", "Skinplate", "Primed RAL", "Framed glass", "Linen"]),
    txt("door_positions", "Door positions per stop (e.g. 0:A, 1:A+B)"),
    sel("car_door_position", "Car doors", ["Front only", "Front & rear", "Adjacent"]),
  ] },
  { title: "Car & controls", fields: [
    sel("car_model", "Car model", ["Standard stainless", "Skinplate", "Panoramic", "Hospital bed", "Heavy duty", "Architectural"]),
    sel("sling", "Sling", ["Cantilever 1:1", "Cantilever 2:1", "Central 1:1", "Central 2:1", "Hydraulic direct", "Hydraulic roped"]),
    sel("car_floor", "Car floor", ["Granite", "PVC", "Chequer plate", "20 mm prepared"]),
    sel("emergency_exit", "Emergency exit", ["Roof trapdoor", "Side", "None"]),
    sel("controller", "Controller", ["Arkel ARL-500", "Arkel Arcube", "Manufacturer standard"], "controllers"),
    sel("cabinet", "Control cabinet", ["Landing jamb (MRL)", "Wall-mounted top landing", "Machine room", "Shaft-mounted"]),
    sel("lop", "Landing fixtures", ["Genemek Retina 7-segment", "TFT 4.3\"", "TFT 7\"", "LCD dot-matrix", "Arrow only", "Manufacturer standard"], "fixtures"),
    sel("cop", "Car operating panel", ["Full height", "Half height", "Horizontal"]),
    sel("evacuation", "Emergency evacuation", ["ARD with open doors", "ARD nearest floor, doors closed", "UPS lowering", "Manual brake release"]),
    txt("compliance", "Compliance (e.g. EN 81-20/50, EN 81-70, fire rated E120)"),
  ] },
];
export const RFQ_FIELDS = RFQ_SECTIONS.flatMap((s) => s.fields);

export type Supplier = { name: string; email: string; package: boolean; options: Partial<Record<SupplierCategory, string[]>> };
export type EstimateConfig = {
  suppliers: Supplier[];
  options: Record<string, string[]>;
  defaults: Record<string, string>;
  reminders: { first_days: number; every_days: number; max: number };
};

export const DEFAULT_SUPPLIERS: Supplier[] = [
  { name: "AH&MET", email: "", package: true, options: { doors: ["Fermator", "AHZ", "AHZ Plus"], controllers: ["Arkel ARL-500", "Arkel Arcube", "AH&MET standard"], fixtures: ["Genemek Retina 7-segment", "AH&MET standard"], machines: ["Montanari", "Alberto Sassi", "Akış"] } },
  { name: "Wittur", email: "", package: true, options: { doors: ["Wittur"] } },
  { name: "Kleemann", email: "", package: true, options: {} },
];

export function parseEstimateConfig(v: unknown): EstimateConfig {
  const o = (v && typeof v === "object" ? v : {}) as Partial<EstimateConfig>;
  const r = o.reminders ?? ({} as Partial<EstimateConfig["reminders"]>);
  return {
    suppliers: Array.isArray(o.suppliers) ? o.suppliers : DEFAULT_SUPPLIERS,
    options: o.options ?? {},
    defaults: o.defaults ?? {},
    reminders: { first_days: Math.max(1, Number(r.first_days) || 5), every_days: Math.max(1, Number(r.every_days) || 3), max: Math.max(0, Number(r.max ?? 3)) },
  };
}

/** Options a field offers: a package supplier's list for its category wins, else the company's list, else the built-in list. */
export function optionsFor(field: RfqField, cfg: EstimateConfig, supplierName?: string | null): string[] {
  const base = cfg.options[field.key]?.length ? cfg.options[field.key] : field.options ?? [];
  if (!field.category || !supplierName) return base;
  const s = cfg.suppliers.find((x) => x.name === supplierName);
  const list = s?.package ? s.options[field.category] : undefined;
  return list?.length ? list : base;
}

/** Suppliers that can supply an already chosen option (empty list = any). */
export function suppliersOffering(field: RfqField, value: string, cfg: EstimateConfig): string[] {
  if (!field.category || !value) return [];
  return cfg.suppliers.filter((s) => s.options[field.category!]?.includes(value)).map((s) => s.name);
}

/** Clears chosen values the newly selected package supplier does not offer. */
export function alignToSupplier(values: Record<string, string>, cfg: EstimateConfig, supplierName: string): Record<string, string> {
  const out = { ...values };
  for (const f of RFQ_FIELDS) if (f.category && out[f.key] && !optionsFor(f, cfg, supplierName).includes(out[f.key])) delete out[f.key];
  return out;
}

export function suggestedPersons(load: string): number | null {
  const kg = parseInt(load, 10);
  return kg ? Math.floor(kg / 75) : null;
}

export type ReminderState = { status: string; sent_at: string | null; last_reminder_at: string | null; reminders_sent: number; reminders_paused: boolean };
const DAY = 86_400_000;
/** "due" when a reminder should go out, "call" once the maximum has been sent, else null. Only while waiting on the supplier. */
export function reminderDue(e: ReminderState, cfg: EstimateConfig, now: number): "due" | "call" | null {
  if (e.status !== "sent" || !e.sent_at || e.reminders_paused) return null;
  const from = new Date(e.last_reminder_at ?? e.sent_at).getTime();
  const wait = (e.reminders_sent === 0 ? cfg.reminders.first_days : cfg.reminders.every_days) * DAY;
  if (now < from + wait) return null;
  return e.reminders_sent >= cfg.reminders.max ? "call" : "due";
}

export function rfqSubject(liftRef: string, title: string, company: string) {
  return `Estimate Request — ${liftRef || title} — ${company}`;
}

export function rfqBody(o: { title: string; values: Record<string, string>; contact?: Record<string, string>; site?: string; company: string; sender: string; notes?: string }) {
  const lines = RFQ_SECTIONS.flatMap((s) => {
    const rows = s.fields.filter((f) => o.values[f.key]).map((f) => `  ${f.label}: ${o.values[f.key]}${f.unit ? ` ${f.unit}` : ""}`);
    return rows.length ? [`${s.title}`, ...rows, ""] : [];
  });
  const c = o.contact ?? {};
  const contact = [c.name, c.role, c.phone, c.email].filter(Boolean).join(" · ");
  return [`Dear supplier,`, ``, `Please send your estimate and lead time for: ${o.title}${o.site ? ` (${o.site})` : ""}.`, ``, ...lines, ...(o.notes ? [`Notes`, `  ${o.notes}`, ``] : []), ...(contact ? [`Site contact: ${contact}`, ``] : []), `Kind regards,`, o.sender, o.company].join("\n");
}

export function reminderBody(o: { subject: string; sentAt: string; sender: string; company: string }) {
  return [`Dear supplier,`, ``, `A kind reminder about our estimate request "${o.subject}" sent on ${new Date(o.sentAt).toLocaleDateString()}. Could you let us know when we can expect your estimate?`, ``, `Kind regards,`, o.sender, o.company].join("\n");
}

export function mailto(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Freehand strokes that are nearly straight snap to a straight line. */
export function straighten(points: { x: number; y: number }[], tolerance = 0.06) {
  if (points.length < 3) return points;
  const a = points[0]!, b = points[points.length - 1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 20) return points;
  const dev = Math.max(...points.map((p) => Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / len));
  return dev / len < tolerance ? [a, b] : points;
}
