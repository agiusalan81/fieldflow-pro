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
  if (!prefill.client_id) {
    const { data: c } = await supabase.from("clients").select("id").order("name").limit(1).maybeSingle();
    if (!c) throw new Error("Your company has no clients yet — ask an admin to add one.");
    prefill.client_id = c.id;
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
  const [h1, m1] = tin.split(":").map(Number);
  const [h2, m2] = tout.split(":").map(Number);
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
