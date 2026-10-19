import type { DwrRow } from "@/lib/dwr";

export const hhmm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export type DwrRecord = {
  report_date: string; shift_start: string; shift_end: string; rows: unknown; break_minutes: number;
  worked_hours: number; vehicle_reg?: string | null; standard_hours: number; ot15_hours: number; ot20_hours: number;
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
  t(`${r.users?.full_name ?? ""}${r.users?.employee_id ? ` (${r.users.employee_id})` : ""}  ·  Shift ${hhmm(r.shift_start)} - ${hhmm(r.shift_end)}${r.vehicle_reg ? `  ·  Vehicle: ${r.vehicle_reg.slice(0, 3)} ${r.vehicle_reg.slice(3)}` : ""}`, M, 10, font, grey); y -= 20;
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

