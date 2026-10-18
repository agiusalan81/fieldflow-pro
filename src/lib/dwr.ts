/** Daily works report (DWR), mandatory break and standby roster rules. */

export type BreakRules = { enabled: boolean; count: number; minutes: number };
export type DwrRow = {
  kind: "job" | "internal" | "break";
  from: string; // HH:MM
  to: string;
  title: string; // e.g. "Job sheet- 007611" / activity / "Mandatory break"
  place: string; // client · site / location
  note: string; // e.g. "Assisting Alan Agius"
};

const toMin = (t: string) => { const [h = 0, m = 0] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Shifts shorter than this get no automatic break. */
export const MIN_SHIFT_FOR_BREAK_MIN = 4 * 60;

/**
 * Breaks are mandatory: they always appear on the DWR, spread evenly through the shift
 * (one break = mid-shift), start rounded to 15 minutes.
 */
export function mandatoryBreaks(start: string, end: string, r: BreakRules): { from: string; to: string }[] {
  if (!r.enabled || r.count < 1 || r.minutes < 1) return [];
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  if (e - s < MIN_SHIFT_FOR_BREAK_MIN) return [];
  const out: { from: string; to: string }[] = [];
  for (let i = 1; i <= r.count; i++) {
    const at = Math.round((s + ((e - s) * i) / (r.count + 1) - r.minutes / 2) / 15) * 15;
    out.push({ from: hm(at), to: hm(at + r.minutes) });
  }
  return out;
}

/** Paid working hours = shift length minus mandatory break time. */
export function workedHours(start: string, end: string, r: BreakRules) {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  const br = mandatoryBreaks(start, end, r).length * r.minutes;
  return Math.round(((e - s - br) / 60) * 100) / 100;
}

/** Whether to nudge a technician to take their break (near mid-shift, not already reminded). */
export function breakDue(shiftStartMs: number, nowMs: number, expectedShiftHours = 8) {
  const h = (nowMs - shiftStartMs) / 3_600_000;
  const mid = expectedShiftHours / 2;
  return h >= mid - 0.75 && h <= mid + 1.5;
}

/** Job sheet search: number fragments ("76", "#76", "Job sheet- 0076") or any text field. */
export function matchesSheetSearch(number: string | number | null | undefined, text: (string | null | undefined)[], q: string) {
  const raw = q.trim().toLowerCase();
  if (!raw) return true;
  const n = String(number ?? "").toLowerCase();
  const digits = raw.replace(/^(job\s*sheet\s*[-#]?\s*|#\s*)/, "").trim();
  if (digits && n.includes(digits)) return true;
  if (digits && /^\d+$/.test(digits) && n.replace(/^0+/, "").includes(digits.replace(/^0+/, "") || "0")) return true;
  return text.filter(Boolean).join(" ").toLowerCase().includes(raw);
}

/** Title used on client PDFs and emails. */
export const sheetTitle = (n: string | number) => `Job sheet- ${n}`;

// ---------- Standby roster ----------
export type StandbyConfig = { start: string; rotationDays: number; perShift: number; order: string[] };
export type Swap = { swap_date: string; requester_id: string; target_id: string; status: string };

/** A roster cannot request more technicians than the company has registered. */
export function validStandbyStaffing(perShift: number, registeredTechnicians: number) {
  return Number.isInteger(perShift) && perShift >= 1 && perShift <= registeredTechnicians;
}

export function clampStandbyStaffing(perShift: number, registeredTechnicians: number) {
  if (registeredTechnicians < 1) return 0;
  return Math.max(1, Math.min(registeredTechnicians, Number.isFinite(perShift) ? Math.floor(perShift) : 1));
}

const dayIndex = (a: string, b: string) => Math.floor((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

/** Who is on standby on a date: rotation by blocks of N days, M people per shift, then accepted swaps. */
export function standbyFor(date: string, c: StandbyConfig, swaps: Swap[] = []): string[] {
  const n = c.order.length;
  if (!n) return [];
  const per = Math.max(1, Math.min(c.perShift, n));
  const rot = Math.max(1, c.rotationDays);
  const block = Math.floor(dayIndex(c.start, date) / rot);
  const first = (((block * per) % n) + n) % n;
  let ids = Array.from({ length: per }, (_, k) => c.order[(first + k) % n]!);
  for (const s of swaps) {
    if (s.status !== "accepted" || s.swap_date !== date) continue;
    if (ids.includes(s.requester_id) && !ids.includes(s.target_id)) ids = ids.map((x) => (x === s.requester_id ? s.target_id : x));
  }
  return ids;
}

// ---------- Held standby DWRs and forgotten clock-outs ----------
const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const atLocal = (ymd: string, hm: string, addDays = 0) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h = 0, mi = 0] = hm.slice(0, 5).split(":").map(Number);
  return new Date(y!, m! - 1, d! + addDays, h, mi);
};

/** A standby technician's DWR is held until the company start time on the morning after the shift. */
export function heldDwrDueAt(shiftStartIso: string, workStart: string) {
  return atLocal(localYmd(new Date(shiftStartIso)), workStart, 1);
}

/** An open shift is "forgotten" once the day it started has passed. */
export function shiftForgotten(shiftStartIso: string, now: Date) {
  return localYmd(new Date(shiftStartIso)) < localYmd(now);
}

/**
 * Auto clock-out time: the later of the company closing time and the last recorded work
 * (job/internal time out + travel), on the day the shift started. Never before the shift start.
 */
export function autoClockOutAt(shiftStartIso: string, workEnd: string, lastActivity: string | null, travelHours = 0) {
  const start = new Date(shiftStartIso);
  const day = localYmd(start);
  let end = atLocal(day, workEnd);
  if (lastActivity) {
    const last = new Date(atLocal(day, lastActivity).getTime() + travelHours * 3_600_000);
    if (last > end) end = last;
  }
  return end > start ? end : start;
}
