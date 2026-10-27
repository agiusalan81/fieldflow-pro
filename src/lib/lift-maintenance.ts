/** Lift & escalator maintenance protocols with EN 81-20 / EN 115-1 guide tolerances and ARD checks. */
export type Protocol = "lift" | "escalator" | "moving_walk";
export type Frequency = "monthly" | "quarterly" | "annual" | "audit";
export type CheckResult = "ok" | "defect" | "na" | "";

export interface CheckItem { key: string; label: string; frequencies: Frequency[] }
export interface Measurement { key: string; label: string; unit: string; min?: number; max?: number; guide: string }

const ALL: Frequency[] = ["monthly", "quarterly", "annual", "audit"];
const QA: Frequency[] = ["quarterly", "annual", "audit"];
const AN: Frequency[] = ["annual", "audit"];

export const LIFT_CHECKS: CheckItem[] = [
  { key: "alarm", label: "Car alarm & two-way communication", frequencies: ALL },
  { key: "lighting", label: "Car & emergency lighting", frequencies: ALL },
  { key: "doors", label: "Door operation, reopening devices & locks", frequencies: ALL },
  { key: "levelling", label: "Floor levelling at all landings", frequencies: ALL },
  { key: "brake", label: "Machine brake operation & wear", frequencies: QA },
  { key: "ropes", label: "Suspension ropes / belts & terminations", frequencies: QA },
  { key: "governor", label: "Overspeed governor & safety gear", frequencies: AN },
  { key: "buffers", label: "Buffers & pit equipment", frequencies: AN },
  { key: "limits", label: "Final limit switches", frequencies: AN },
  { key: "pit_stop", label: "Pit & car-top stop switches / inspection control", frequencies: ALL },
  { key: "hydraulic", label: "Hydraulic oil level, leaks & rupture valve (hydraulic only)", frequencies: QA },
];

export const ESCALATOR_CHECKS: CheckItem[] = [
  { key: "estop", label: "Emergency stop buttons (all)", frequencies: ALL },
  { key: "handrail", label: "Handrail condition & speed sync", frequencies: ALL },
  { key: "comb", label: "Comb plates & comb teeth", frequencies: ALL },
  { key: "skirt", label: "Skirt deflectors & skirt switches", frequencies: ALL },
  { key: "steps", label: "Steps / pallets, demarcation & missing step device", frequencies: ALL },
  { key: "brake", label: "Brake & stopping distance", frequencies: QA },
  { key: "chain", label: "Step chain tension & lubrication", frequencies: QA },
  { key: "inlet", label: "Handrail inlet guard switches", frequencies: ALL },
  { key: "reversal", label: "Unintended reversal / overspeed protection", frequencies: AN },
];

export const LIFT_MEASUREMENTS: Measurement[] = [
  { key: "levelling", label: "Stopping / levelling accuracy", unit: "mm", min: -10, max: 10, guide: "EN 81-20 5.12.1.1.4: ±10 mm" },
  { key: "relevelling", label: "Re-levelling accuracy", unit: "mm", min: -20, max: 20, guide: "EN 81-20: ±20 mm during loading" },
  { key: "door_force", label: "Door closing force", unit: "N", max: 150, guide: "EN 81-20 5.3.6.2: ≤150 N" },
  { key: "door_gap", label: "Door panel / sill gap", unit: "mm", max: 6, guide: "EN 81-20 5.3.1.4: ≤6 mm (10 mm worn)" },
  { key: "sill_gap", label: "Car sill to landing sill gap", unit: "mm", max: 35, guide: "EN 81-20 5.3.4: ≤35 mm" },
  { key: "light", label: "Car lighting at controls", unit: "lux", min: 100, guide: "EN 81-20 5.4.10: ≥100 lux" },
  { key: "pit_refuge", label: "Pit refuge clearance", unit: "mm", min: 500, guide: "EN 81-20 5.2.5.8: ≥0.5 m" },
];

export const ESCALATOR_MEASUREMENTS: Measurement[] = [
  { key: "skirt_gap", label: "Skirt to step gap (one side)", unit: "mm", max: 4, guide: "EN 115-1 5.5.4: ≤4 mm" },
  { key: "skirt_sum", label: "Skirt gap, both sides combined", unit: "mm", max: 7, guide: "EN 115-1 5.5.4: ≤7 mm" },
  { key: "step_gap", label: "Gap between consecutive steps", unit: "mm", max: 6, guide: "EN 115-1 5.3.5: ≤6 mm" },
  { key: "comb_mesh", label: "Comb teeth meshing depth", unit: "mm", min: 4, guide: "EN 115-1 5.7.3: ≥4 mm" },
  { key: "comb_clear", label: "Comb clearance to tread", unit: "mm", max: 4, guide: "EN 115-1 5.7.3: ≤4 mm" },
  { key: "handrail_speed", label: "Handrail speed deviation", unit: "%", min: 0, max: 2, guide: "EN 115-1 5.6.1: 0 to +2 %" },
  { key: "stop_distance", label: "Unloaded stopping distance (0.5 m/s)", unit: "m", min: 0.2, max: 1.0, guide: "EN 115-1 5.4.2: 0.20–1.00 m" },
];

export const ARD_CHECKS: CheckItem[] = [
  { key: "battery", label: "ARD battery condition / voltage under load", frequencies: ALL },
  { key: "mains_loss", label: "Mains-loss simulation triggers rescue mode", frequencies: QA },
  { key: "movement", label: "Car moves to nearest landing", frequencies: QA },
  { key: "release", label: "Doors open & passengers released", frequencies: QA },
  { key: "alarm", label: "Alarm & communication remain powered", frequencies: QA },
  { key: "anti_drift", label: "Hydraulic anti-drift / anti-creep (hydraulic only)", frequencies: QA },
];

export function checksFor(protocol: Protocol, frequency: Frequency): CheckItem[] {
  const list = protocol === "lift" ? LIFT_CHECKS : ESCALATOR_CHECKS;
  return list.filter((c) => c.frequencies.includes(frequency));
}
export function measurementsFor(protocol: Protocol): Measurement[] {
  return protocol === "lift" ? LIFT_MEASUREMENTS : ESCALATOR_MEASUREMENTS;
}
export function ardFor(protocol: Protocol, frequency: Frequency): CheckItem[] {
  return protocol === "lift" ? ARD_CHECKS.filter((c) => c.frequencies.includes(frequency)) : [];
}

/** Returns "pass" | "fail" | null (no value) for a reading against its guide tolerance. */
export function evaluate(m: Measurement, raw: string | undefined): "pass" | "fail" | null {
  if (raw == null || raw.trim() === "") return null;
  const v = Number(raw.replace(",", "."));
  if (!Number.isFinite(v)) return null;
  if (m.min != null && v < m.min) return "fail";
  if (m.max != null && v > m.max) return "fail";
  return "pass";
}

export function protocolForCategory(category: string | null | undefined): Protocol | null {
  const c = (category ?? "").toLowerCase();
  if (/moving\s*walk|travelator|autowalk/.test(c)) return "moving_walk";
  if (/escalator/.test(c)) return "escalator";
  if (/lift|elevator|hoist|dumb\s*waiter|platform/.test(c)) return "lift";
  return null;
}

export interface Defect { source: string; label: string; detail?: string }

/** Collects every defect from checks, out-of-tolerance readings and failed ARD steps. */
export function collectDefects(
  protocol: Protocol, frequency: Frequency,
  checks: Record<string, CheckResult>, readings: Record<string, string>, ard: Record<string, CheckResult>,
): Defect[] {
  const out: Defect[] = [];
  for (const c of checksFor(protocol, frequency)) if (checks[c.key] === "defect") out.push({ source: "check", label: c.label });
  for (const m of measurementsFor(protocol)) if (evaluate(m, readings[m.key]) === "fail") out.push({ source: "measurement", label: m.label, detail: `${readings[m.key]} ${m.unit} — guide ${m.guide}` });
  for (const c of ardFor(protocol, frequency)) if (ard[c.key] === "defect") out.push({ source: "ard", label: `ARD: ${c.label}` });
  return out;
}

/** One customer-quote line description per recorded defect, ready for the office to price. */
export function defectQuoteLines(defects: Defect[]): string[] {
  return defects.map((d) => `Corrective work: ${d.label}${d.detail ? ` (${d.detail})` : ""}`);
}

export function missingChecks(protocol: Protocol, frequency: Frequency, checks: Record<string, CheckResult>, ard: Record<string, CheckResult>): number {
  return checksFor(protocol, frequency).filter((c) => !checks[c.key]).length + ardFor(protocol, frequency).filter((c) => !ard[c.key]).length;
}

/** Client copy of a completed protocol: plain wording, no readings, tolerances or internal notes. */
export function clientChecklistSummary(
  protocol: Protocol, frequency: Frequency,
  checks: Record<string, CheckResult>, ard: Record<string, CheckResult>, outOfService: boolean,
): string {
  const word = (r: CheckResult | undefined) => r === "ok" ? "Checked — OK" : r === "defect" ? "Attention required" : r === "na" ? "Not applicable" : "Not checked";
  const lines = [...checksFor(protocol, frequency).map((c) => `• ${c.label}: ${word(checks[c.key])}`), ...ardFor(protocol, frequency).map((c) => `• Emergency rescue (ARD) — ${c.label}: ${word(ard[c.key])}`)];
  if (outOfService) lines.push("Equipment left out of service for safety. Our office will contact you.");
  return lines.join("\n");
}
