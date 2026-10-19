import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/profile";

/** Creates a draft job sheet for the signed-in technician, pre-filled from a scheduled job when given. */
export async function createDraftSheet(profile: Profile, jobId?: string) {
  let prefill: Record<string, unknown> = {};
  if (jobId) {
    const { data: existing } = await supabase.from("job_sheets").select("id").eq("job_id", jobId).neq("status", "completed").maybeSingle();
    if (existing) return existing.id;
    const { data: job } = await supabase
      .from("jobs")
      .select("id, client_id, site_id, asset_id, problem_summary, assets(asset_category, custom_attributes, serial_number)")
      .eq("id", jobId)
      .maybeSingle();
    if (job) {
      const cat = (job.assets?.asset_category ?? "").toLowerCase();
      prefill = {
        job_id: job.id, client_id: job.client_id, site_id: job.site_id, asset_id: job.asset_id,
        reported_fault: job.problem_summary,
        lift_model: ((job.assets?.custom_attributes as Record<string, unknown> | null)?.["model"] as string) ?? null,
        serial_number: job.assets?.serial_number ?? ((job.assets?.custom_attributes as Record<string, unknown> | null)?.["serial"] as string) ?? null,
        asset_type: cat.includes("escalator") ? "Escalator" : cat.includes("lift") || !cat ? "Lift" : "Other",
        asset_type_other: cat && !cat.includes("lift") && !cat.includes("escalator") ? job.assets?.asset_category : null,
      };
    }
  }
  if (!prefill["client_id"]) {
    const { data: c } = await supabase.from("clients").select("id").order("name").limit(1).maybeSingle();
    if (!c) throw new Error("Your company has no clients yet — ask an admin to add one.");
    prefill["client_id"] = c.id;
  }
  const { data, error } = await supabase
    .from("job_sheets")
    .insert({
      ...(prefill as { client_id: string }),
      company_id: profile.company_id,
      assigned_technician_id: profile.id,
      technician_name: profile.full_name,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Start a scheduled journey without resetting a sheet already on site or completed. */
export async function startJobTravel(profile: Profile, jobId: string) {
  const id = await createDraftSheet(profile, jobId);
  const { data: sheet, error: readError } = await supabase.from("job_sheets").select("status").eq("id", id).single();
  if (readError) throw readError;
  if (sheet.status === "in_progress" || sheet.status === "completed") throw new Error("This job is already on site or completed. Open its job sheet instead.");
  if (sheet.status !== "in_transit") {
    const { error } = await supabase.from("job_sheets").update({ status: "in_transit", travel_start_time: new Date().toISOString() }).eq("id", id).eq("status", sheet.status).select("id").single();
    if (error) throw error;
  }
  const { error } = await supabase.from("jobs").update({ acknowledged_at: new Date().toISOString() }).eq("id", jobId).is("acknowledged_at", null);
  if (error) throw error;
  return id;
}

/** Hours between two HH:MM times on the same day (handles overnight). */
export function hoursFromTimes(tin?: string | null, tout?: string | null) {
  if (!tin || !tout) return 0;
  const [h1 = 0, m1 = 0] = tin.split(":").map(Number);
  const [h2 = 0, m2 = 0] = tout.split(":").map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

/** Leave hours: 8 hours for each weekday (Mon–Fri) in the inclusive range. */
export function leaveHours(start: string, end: string, hoursPerDay = 8) {
  if (!start || !end || end < start) return 0;
  let n = 0;
  const d = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  while (d <= e) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n * hoursPerDay;
}

export function remainingBalance(b: { base: number; ph: number; taken: number; pending: number; carried?: number }) {
  return b.base + b.ph + (b.carried ?? 0) - b.taken - b.pending;
}

export function missingSignOff(s: { client_full_name?: string | null; client_id_card_no?: string | null; signature?: string | null }) {
  const missing: string[] = [];
  if (!s.client_full_name?.trim()) missing.push("Client full name");
  if (!s.client_id_card_no?.trim()) missing.push("Client ID card no.");
  if (!s.signature) missing.push("Client signature");
  return missing;
}

/** Rounds an HH:MM time to the nearest 15 minutes (wraps past midnight). */
export function roundTo15(t?: string | null) {
  if (!t) return "";
  const [h = 0, m = 0] = t.split(":").map(Number);
  const total = (Math.round((h * 60 + m) / 15) * 15) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Shifts an HH:MM time by a number of minutes, snapped to 15. */
export function shiftTime(t: string | null | undefined, delta: number) {
  const base = roundTo15(t || "08:00");
  const [h = 0, m = 0] = base.split(":").map(Number);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** A job sheet photo. "work" photos go to the client email; "pending" photos stay internal. */
export type JobPhoto = { path: string; scope: "work" | "pending"; kind: "damage" | "part" | "other"; day: number | null };

export function parsePhotos(v: unknown): JobPhoto[] {
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is JobPhoto => !!p && typeof p === "object" && typeof (p as JobPhoto).path === "string" && ((p as JobPhoto).scope === "work" || (p as JobPhoto).scope === "pending"));
}

/** Only work-log photos may ever be sent to a client. */
export const clientPhotos = (photos: JobPhoto[]) => photos.filter((p) => p.scope === "work");

/** Admin job-sheet filter: a status value, "all", or an operational queue filter. */
export type SheetFilterRow = { status: string; requires_admin_approval?: boolean | null; pending_works_future_jobs?: string | null };
export function matchesSheetFilter(j: SheetFilterRow, filter: string) {
  const pending = !!(j.pending_works_future_jobs ?? "").trim();
  const approval = !!j.requires_admin_approval;
  if (filter === "all") return true;
  if (filter === "needs_approval") return approval;
  if (filter === "has_pending") return pending;
  if (filter === "admin_queue") return approval || pending;
  return j.status === filter;
}

export function technicianCount(count: number | null | undefined, initials: string[] = []) {
  return Math.max(1, Math.floor(count || 1), new Set(initials.filter(Boolean)).size);
}

export function labourHours(tin: string | null | undefined, tout: string | null | undefined, count: number, initials: string[] = []) {
  return +(hoursFromTimes(tin, tout) * technicianCount(count, initials)).toFixed(2);
}

export function matchesSheetDetails(j: { created_at: string; client_id: string; assigned_technician_id: string | null; jobsheet_time_logs?: { technician_initials?: string[] }[] }, f: { from: string; to: string; client: string; technician: string; initials?: string | undefined }) {
  const date = j.created_at.slice(0, 10);
  return (!f.from || date >= f.from) && (!f.to || date <= f.to) &&
    (f.client === "all" || j.client_id === f.client) &&
    (f.technician === "all" || j.assigned_technician_id === f.technician || !!f.initials && !!j.jobsheet_time_logs?.some((l) => l.technician_initials?.includes(f.initials ?? "")));
}

export function validateCombinedSheets(sheets: { client_id: string; status: string }[]) {
  if (!sheets.length) throw new Error("Select job sheets first");
  if (sheets.some((s) => s.status !== "completed")) throw new Error("Only completed job sheets can be combined");
  if (new Set(sheets.map((s) => s.client_id)).size !== 1) throw new Error("Select job sheets for one customer at a time");
}

/** Company hours & overtime rules used to split logged time into pay/billing buckets. */
export type OvertimeRules = {
  work_days: number[]; // 0=Sun … 6=Sat
  work_start: string; // HH:MM
  work_end: string;
  after_hours_rate: number;
  saturday_rate: number;
  sunday_rate: number;
  holiday_rate: number;
  public_holidays: string[]; // YYYY-MM-DD
};
export const DEFAULT_RULES: OvertimeRules = {
  work_days: [1, 2, 3, 4, 5], work_start: "07:30", work_end: "16:30",
  after_hours_rate: 1.5, saturday_rate: 1.5, sunday_rate: 2, holiday_rate: 2, public_holidays: [],
};
export type HourSplit = { standard: number; ot15: number; ot20: number };

const toMin = (t: string) => { const [h = 0, m = 0] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };

/** Rate multiplier that applies to one minute of work on a date. */
export function rateFor(date: string, minute: number, r: OvertimeRules) {
  const wd = new Date(date + "T00:00:00Z").getUTCDay();
  if (r.public_holidays.includes(date)) return r.holiday_rate;
  if (wd === 0 && !r.work_days.includes(0)) return r.sunday_rate;
  if (r.work_days.includes(wd)) return minute >= toMin(r.work_start) && minute < toMin(r.work_end) ? 1 : r.after_hours_rate;
  if (wd === 6) return r.saturday_rate;
  return r.after_hours_rate;
}

/** Splits a time-in/time-out on a date into standard, 1.5× and 2.0× hours (handles overnight). */
export function splitHours(date: string, tin?: string | null, tout?: string | null, r: OvertimeRules = DEFAULT_RULES): HourSplit {
  const out: HourSplit = { standard: 0, ot15: 0, ot20: 0 };
  if (!date || !tin || !tout) return out;
  const start = toMin(tin);
  let end = toMin(tout);
  if (end <= start) end += 1440;
  const next = new Date(date + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
  const nextDate = next.toISOString().slice(0, 10);
  for (let m = start; m < end; m++) {
    const rate = m < 1440 ? rateFor(date, m, r) : rateFor(nextDate, m - 1440, r);
    if (rate >= 2) out.ot20++; else if (rate > 1) out.ot15++; else out.standard++;
  }
  const h = (n: number) => Math.round((n / 60) * 100) / 100;
  return { standard: h(out.standard), ot15: h(out.ot15), ot20: h(out.ot20) };
}

export function addSplits(a: HourSplit, b: HourSplit): HourSplit {
  return { standard: +(a.standard + b.standard).toFixed(2), ot15: +(a.ot15 + b.ot15).toFixed(2), ot20: +(a.ot20 + b.ot20).toFixed(2) };
}

/** Checklist items still unticked. */
export function missingChecklist(items: string[], values: Record<string, boolean> | null | undefined) {
  return items.filter((i) => !values?.[i]);
}

/** Days from today until a contract end date (negative = expired). */
export function daysUntil(end: string, today = new Date().toISOString().slice(0, 10)) {
  return Math.round((new Date(end + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86_400_000);
}
export const dueForRenewal = (end: string, noticeDays = 30, today?: string) => { const d = daysUntil(end, today); return d >= 0 && d <= noticeDays; };

/** Default maintenance visits per year by contract tier (Custom stays manual). */
export const TIER_VISITS: Record<string, number> = { Bronze: 4, Silver: 6, Gold: 12 };
export const visitsForTier = (tier: string, current: number) => TIER_VISITS[tier] ?? current;
/** Suggested contract type name from category + tier, e.g. "Residential Gold". */
export const contractName = (category: string, tier: string) => [category, tier === "Custom" ? "" : tier].filter(Boolean).join(" ");

/** Everyone (every role) must be clocked in (an open "shift") before creating a job sheet. Also enforced in the database. */
export const needsClockIn = (_role: string, openShiftTypes: string[]) => !openShiftTypes.includes("shift");

/** Applicant balance before approving one pending Annual request (its hours are already counted in pending). */
export function approvalBalance(b: { base: number; ph: number; taken: number; pending: number; carried?: number }, requestHours: number) {
  const available = remainingBalance({ ...b, pending: b.pending - requestHours });
  const after = available - requestHours;
  return { available, after, exceedsBy: after < 0 ? -after : 0 };
}

/** Billable hours for one day: (on-site time + travel + time acquiring parts) × technician count, with a 1-hour minimum charge per technician once any work is logged. */
export function dayLabourHours(tin: string | null | undefined, tout: string | null | undefined, travel: number, count: number, initials: string[] = [], partsHours = 0) {
  const techs = technicianCount(count, initials);
  const raw = hoursFromTimes(tin, tout) + (Number(travel) || 0) + (Number(partsHours) || 0);
  if (raw <= 0) return 0;
  return +(Math.max(raw, 1) * techs).toFixed(2);
}
