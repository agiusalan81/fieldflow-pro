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
      .select("id, client_id, site_id, asset_id, problem_summary, assets(asset_category, custom_attributes)")
      .eq("id", jobId)
      .maybeSingle();
    if (job) {
      const cat = (job.assets?.asset_category ?? "").toLowerCase();
      prefill = {
        job_id: job.id, client_id: job.client_id, site_id: job.site_id, asset_id: job.asset_id,
        reported_fault: job.problem_summary,
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

export function remainingBalance(b: { base: number; ph: number; taken: number; pending: number }) {
  return b.base + b.ph - b.taken - b.pending;
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
