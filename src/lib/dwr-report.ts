import { supabase } from "@/integrations/supabase/client";
import { mandatoryBreaks, workedHours, sheetTitle, type BreakRules, type DwrRow } from "@/lib/dwr";
import { splitHours, type OvertimeRules } from "@/lib/jobsheets";

import { dwrPdf, hhmm, type DwrRecord } from "@/lib/dwr-pdf";
export type { DwrRecord };
const localDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Builds and files the daily works report for a shift that just ended. */
export async function fileDailyReport(p: { userId: string; companyId: string; shiftId: string; startedAt: string; endedAt: string; rules: OvertimeRules; breaks: BreakRules }) {
  const date = localDate(p.startedAt);
  const [{ data: sheets }, { data: internal }] = await Promise.all([
    supabase.rpc("dwr_sheet_entries", { _user: p.userId, _date: date }),
    supabase.from("internal_work_logs").select("*").eq("user_id", p.userId).eq("log_date", date).order("time_in"),
  ]);
  const start = hhmm(p.startedAt), end = hhmm(p.endedAt);
  const rows: DwrRow[] = [
    ...(sheets ?? []).map((s) => ({
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
    shift_start: p.startedAt, shift_end: p.endedAt, rows: rows as never,
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
