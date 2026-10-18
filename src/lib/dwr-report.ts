import { supabase } from "@/integrations/supabase/client";
import { mandatoryBreaks, workedHours, sheetTitle, type BreakRules, type DwrRow } from "@/lib/dwr";
import { splitHours, type OvertimeRules } from "@/lib/jobsheets";

import { dwrPdf, hhmm, type DwrRecord } from "@/lib/dwr-pdf";
export type { DwrRecord };
const localDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Builds and files the daily works report for a shift that just ended. */
export async function fileDailyReport(p: { userId: string; companyId: string; shiftId: string; startedAt: string; endedAt: string; rules: OvertimeRules; breaks: BreakRules; overnightBefore?: string | undefined }) {
  const date = localDate(p.startedAt);
  const next = localDate(new Date(new Date(p.startedAt).getTime() + 86_400_000).toISOString());
  const [{ data: day }, { data: internal }, { data: night }] = await Promise.all([
    supabase.rpc("dwr_sheet_entries", { _user: p.userId, _date: date }),
    supabase.from("internal_work_logs").select("*").eq("user_id", p.userId).eq("log_date", date).order("time_in"),
    p.overnightBefore ? supabase.rpc("dwr_sheet_entries", { _user: p.userId, _date: next }) : Promise.resolve({ data: [] as never[] }),
  ]);
  // Standby: overnight callouts after midnight but before the next morning's start belong to this report.
  const sheets = [...(day ?? []), ...((night ?? []) as NonNullable<typeof day>).filter((s) => s.time_in && s.time_in.slice(0, 5) < p.overnightBefore!)];
  const start = hhmm(p.startedAt), end = hhmm(p.endedAt);
  const rows: DwrRow[] = [
    ...sheets.map((s) => ({
      kind: "job" as const, from: s.time_in?.slice(0, 5) ?? "", to: s.time_out?.slice(0, 5) ?? "",
      title: sheetTitle(s.jobsheet_number), place: [s.client, s.site].filter(Boolean).join(" · "),
      note: s.assisting ? `Assisting ${s.lead_name ?? "lead technician"}` : `Lead${Number(s.travel) ? ` · travel ${s.travel} h` : ""}`,
    })),
    ...(internal ?? []).map((i) => ({ kind: "internal" as const, from: i.time_in.slice(0, 5), to: i.time_out.slice(0, 5), title: i.activity, place: i.location ?? "", note: i.notes ?? "" })),
    ...mandatoryBreaks(start, end, p.breaks).map((b) => ({ kind: "break" as const, ...b, title: "Mandatory break", place: "", note: `${p.breaks.minutes} min` })),
  ].sort((a, b) => a.from.localeCompare(b.from));

  const split = splitHours(date, start, end, p.rules);
  const breakH = (mandatoryBreaks(start, end, p.breaks).length * p.breaks.minutes) / 60;
  const { data, error } = await supabase.from("daily_work_reports").insert({
    company_id: p.companyId, user_id: p.userId, shift_id: p.shiftId, report_date: date,
    shift_start: p.startedAt, shift_end: p.endedAt, rows: rows as never, overtime_rules: p.rules as never,
    break_minutes: Math.round(breakH * 60), worked_hours: workedHours(start, end, p.breaks),
    standard_hours: Math.max(0, +(split.standard - breakH).toFixed(2)), ot15_hours: split.ot15, ot20_hours: split.ot20,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function downloadDwr(r: DwrRecord, company: string) {
  const bytes = await dwrPdf(r, company);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url; a.download = `DWR_${r.report_date}_${(r.users?.full_name ?? "technician").replace(/\s+/g, "_")}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Builds the PDF in the browser (local times) and emails it to the technician. */
export async function emailDwr(r: DwrRecord, company: string) {
  const { sendDwrEmail } = await import("@/lib/sendDwrEmail");
  const bytes = await dwrPdf(r, company);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return sendDwrEmail({ data: { pdfBase64: btoa(bin), filename: `DWR_${r.report_date}.pdf`, date: r.report_date } });
}

/** After a job sheet is closed near mid-shift, nudge the technician to take their break (once per shift). */
export async function remindBreakIfDue(userId: string, breaks: { enabled: boolean; minutes: number }, notify: (msg: string) => void) {
  if (!breaks.enabled) return;
  const { data } = await supabase.from("shifts").select("id, started_at").eq("user_id", userId).eq("shift_type", "shift").is("ended_at", null).maybeSingle();
  if (!data) return;
  const key = `break-reminded-${data.id}`;
  if (localStorage.getItem(key)) return;
  const { breakDue } = await import("@/lib/dwr");
  if (!breakDue(new Date(data.started_at).getTime(), Date.now())) return;
  localStorage.setItem(key, "1");
  notify(`Time for your ${breaks.minutes}-minute break. It's recorded on your daily works report.`);
}

type Company = { rules: OvertimeRules; breaks: BreakRules };
type Sh = { id: string; started_at: string; ended_at: string | null; dwr_held?: boolean };

/** Files the DWR now, or holds it until next morning when the technician is on standby tonight. */
export async function closeShiftReport(p: { userId: string; companyId: string; shift: Sh; endedAt: string; company: Company; companyName: string }) {
  const { data: standby } = await supabase.rpc("is_on_standby", { _user: p.userId, _date: localDate(p.shift.started_at) });
  if (standby) {
    await supabase.from("shifts").update({ dwr_held: true }).eq("id", p.shift.id);
    return { held: true as const };
  }
  return { held: false as const, ...(await fileAndEmail({ ...p, overnight: false })) };
}

async function fileAndEmail(p: { userId: string; companyId: string; shift: Sh; endedAt: string; company: Company; companyName: string; overnight: boolean }) {
  const id = await fileDailyReport({ userId: p.userId, companyId: p.companyId, shiftId: p.shift.id, startedAt: p.shift.started_at, endedAt: p.endedAt, rules: p.company.rules, breaks: p.company.breaks, overnightBefore: p.overnight ? p.company.rules.work_start : undefined });
  const { data: r } = await supabase.from("daily_work_reports").select("*, users(full_name, employee_id)").eq("id", id).single();
  const mail = r ? await emailDwr(r, p.companyName).catch(() => ({ sent: false })) : { sent: false };
  return { report: r, sent: mail.sent };
}

/**
 * Runs when the dashboard opens or a technician clocks in:
 * 1) closes shifts left open from a previous day at max(closing time, last recorded work) and flags them;
 * 2) files held standby DWRs once the next morning's start time has passed (or immediately on clock-in).
 */
export async function reconcileShifts(p: { userId: string; companyId: string; company: Company; companyName: string; force?: boolean }) {
  const { autoClockOutAt, shiftForgotten, heldDwrDueAt } = await import("@/lib/dwr");
  const now = new Date();
  const msgs: string[] = [];
  const { data: open } = await supabase.from("shifts").select("id, started_at, ended_at, shift_type").eq("user_id", p.userId).is("ended_at", null);
  for (const s of open ?? []) {
    if (!shiftForgotten(s.started_at, now)) continue;
    const date = localDate(s.started_at);
    const [{ data: sheets }, { data: internal }] = await Promise.all([
      supabase.rpc("dwr_sheet_entries", { _user: p.userId, _date: date }),
      supabase.from("internal_work_logs").select("time_out").eq("user_id", p.userId).eq("log_date", date),
    ]);
    let last: string | null = null; let travel = 0;
    for (const e of sheets ?? []) if (e.time_out && (!last || e.time_out.slice(0, 5) > last)) { last = e.time_out.slice(0, 5); travel = Number(e.travel) || 0; }
    for (const e of internal ?? []) if (e.time_out && (!last || e.time_out.slice(0, 5) > last)) { last = e.time_out.slice(0, 5); travel = 0; }
    const end = autoClockOutAt(s.started_at, p.company.rules.work_end, last, travel).toISOString();
    const note = last ? `Forgot to clock out — closed at last recorded work (${hhmm(end)})` : `Forgot to clock out — closed at company closing time (${hhmm(end)})`;
    const { error } = await supabase.from("shifts").update({ ended_at: end, auto_closed: true, auto_close_note: note }).eq("id", s.id);
    if (error || s.shift_type !== "shift") continue;
    msgs.push(note);
    await closeShiftReport({ ...p, shift: s, endedAt: end });
  }
  const { data: held } = await supabase.from("shifts").select("id, started_at, ended_at").eq("user_id", p.userId).eq("dwr_held", true).not("ended_at", "is", null);
  for (const s of held ?? []) {
    if (!p.force && now < heldDwrDueAt(s.started_at, p.company.rules.work_start)) continue;
    await supabase.from("shifts").update({ dwr_held: false }).eq("id", s.id);
    const { sent } = await fileAndEmail({ ...p, shift: s, endedAt: s.ended_at!, overnight: true });
    msgs.push(sent ? "Standby daily works report emailed" : "Standby daily works report saved");
  }
  return msgs;
}
