/** Payroll / accounting-neutral CSV of filed daily work reports (Excel, Sage, Xero, QuickBooks all import CSV). */
export type HoursExportRow = {
  report_date: string; shift_start: string | null; shift_end: string | null; break_minutes: number | null;
  worked_hours: number | null; standard_hours: number | null; ot15_hours: number | null; ot20_hours: number | null;
  vehicle_reg?: string | null; rows?: unknown; superseded_by?: string | null;
  users?: { full_name: string | null; employee_id: string | null } | null;
};

export const HOURS_HEADER = ["Date", "Employee_Name", "Employee_ID", "Shift_Start", "Shift_End", "Break_Minutes", "Total_Worked_Hours", "Standard_Hours", "Overtime_1_5x_Hours", "Overtime_2_0x_Hours", "Jobs_Logged", "Vehicle"];

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/^[=+@-]/, "'")}"`;
const time = (s: string | null) => (s ? new Date(s).toTimeString().slice(0, 5) : "");

/** Superseded (corrected) reports are excluded so hours are never counted twice. */
export function hoursCsv(rows: HoursExportRow[]) {
  const lines = rows.filter((r) => !r.superseded_by).map((r) => [
    r.report_date, r.users?.full_name, r.users?.employee_id, time(r.shift_start), time(r.shift_end), Number(r.break_minutes ?? 0),
    Number(r.worked_hours ?? 0), Number(r.standard_hours ?? 0), Number(r.ot15_hours ?? 0), Number(r.ot20_hours ?? 0),
    Array.isArray(r.rows) ? r.rows.length : 0, r.vehicle_reg,
  ]);
  return [HOURS_HEADER, ...lines].map((l) => l.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
