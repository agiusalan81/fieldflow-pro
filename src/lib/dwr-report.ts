import { supabase } from "@/integrations/supabase/client";
import { mandatoryBreaks, workedHours, sheetTitle, type BreakRules, type DwrRow } from "@/lib/dwr";
import { splitHours, type OvertimeRules } from "@/lib/jobsheets";

const hhmm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);
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

export type DwrRecord = {
  report_date: string; shift_start: string; shift_end: string; rows: unknown; break_minutes: number;
  worked_hours: number; standard_hours: number; ot15_hours: number; ot20_hours: number;
  users?: { full_name: string; employee_id: string | null } | null;
};

const safe = (s: unknown) => String(s ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "?");

/** A4 table PDF of one daily works report. */
export async function dwrPdf(r: DwrRecord, company: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 40;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const grey = rgb(0.4, 0.4, 0.45);
  const t = (s: string, x: number, size = 9, f = font, c = rgb(0.1, 0.1, 0.12)) => page.drawText(safe(s).slice(0, 70), { x, y, size, font: f, color: c });
  t(company, M, 16, bold); y -= 18;
  t(`Daily works report - ${r.report_date}`, M, 12, bold); y -= 14;
  t(`${r.users?.full_name ?? ""}${r.users?.employee_id ? ` (${r.users.employee_id})` : ""}  ·  Shift ${hhmm(r.shift_start)} - ${hhmm(r.shift_end)}`, M, 10, font, grey); y -= 20;
  const cols = [M, M + 75, M + 205, M + 375];
  ["Time", "Activity", "Client / site / location", "Notes"].forEach((h, i) => t(h, cols[i]!, 9, bold)); y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: grey }); y -= 12;
  for (const row of (Array.isArray(r.rows) ? r.rows : []) as DwrRow[]) {
    if (y < M + 60) { page = doc.addPage([W, H]); y = H - M; }
    t(`${row.from} - ${row.to}`, cols[0]!); t(row.title, cols[1]!, 9, row.kind === "break" ? bold : font); t(row.place, cols[2]!); t(row.note, cols[3]!);
    y -= 14;
  }
  y -= 10; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: grey }); y -= 16;
  t(`Worked ${Number(r.worked_hours).toFixed(2)} h  ·  Break ${r.break_minutes} min  ·  Standard ${Number(r.standard_hours).toFixed(2)} h  ·  OT 1.5x ${Number(r.ot15_hours).toFixed(2)} h  ·  OT 2x ${Number(r.ot20_hours).toFixed(2)} h`, M, 9, bold);
  return doc.save();
}

export async function downloadDwr(r: DwrRecord, company: string) {
  const bytes = await dwrPdf(r, company);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url; a.download = `DWR_${r.report_date}_${(r.users?.full_name ?? "technician").replace(/\s+/g, "_")}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
