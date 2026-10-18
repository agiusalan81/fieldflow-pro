import { standbyFor, type StandbyConfig, type Swap } from "@/lib/dwr";

export type PayrollPolicy = { effective_from: string; standby_weekly_eur: number; sick_full_hours: number; sick_half_hours: number };
export type WageSettings = { hourly_rate: number; sick_full_hours: number; sick_half_hours: number; tax_reference?: string | null };
export type PayrollDwr = { id: string; user_id: string; report_date: string; shift_id: string | null; standard_hours: number; ot15_hours: number; ot20_hours: number };
export type PayrollLeave = { id: string; user_id: string; start_date: string; end_date: string; total_hours: number; leave_type: string; status: string };
export type RosterVersion = { effective_from: string; roster_start: string; rotation_days: number; per_shift: number; technician_order: string[] };
export type PayrollHours = { worked: number; leave: number; sickFull: number; sickHalf: number; sickUnpaid: number; normal: number; ot15: number; ot20: number; standbyDays: number; standbyPay: number; fullUsed: number; halfUsed: number; sourceIds: string[] };
export type WageAdjustments = { bonus: number; tax: number; nationalInsurance: number; otherDeductions: number };
export const DEFAULT_PAYROLL_POLICY: PayrollPolicy = { effective_from: "2000-01-01", standby_weekly_eur: 50, sick_full_hours: 0, sick_half_hours: 0 };
export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const euros = (n: number) => new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" }).format(n);
export const officePayrollAccess = (realRole?: string) => realRole === "admin" || realRole === "superuser";
export function datesBetween(from: string, to: string) {
  const start = new Date(from + "T00:00:00Z"), end = new Date(to + "T00:00:00Z");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || (end.getTime() - start.getTime()) / 86400000 > 366) return [];
  const dates: string[] = [];
  for (const d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
  return dates;
}
export function policyOn(date: string, policies: PayrollPolicy[]) {
  return [...policies].filter(p => p.effective_from <= date).sort((a,b) => b.effective_from.localeCompare(a.effective_from))[0] ?? DEFAULT_PAYROLL_POLICY;
}
export function validPayrollPeriod(from: string, to: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from.slice(0,4) === to.slice(0,4) && datesBetween(from,to).length > 0;
}
/** DWR is the single worked-time source; approved absence hours are spread across the request's weekdays. */
export function aggregatePayroll(userId: string, from: string, to: string, reports: PayrollDwr[], leaves: PayrollLeave[], wage: WageSettings, policies: PayrollPolicy[], rosters: RosterVersion[], swaps: Swap[]): PayrollHours {
  const result: PayrollHours = { worked: 0, leave: 0, sickFull: 0, sickHalf: 0, sickUnpaid: 0, normal: 0, ot15: 0, ot20: 0, standbyDays: 0, standbyPay: 0, fullUsed: 0, halfUsed: 0, sourceIds: [] };
  if (!validPayrollPeriod(from,to)) return result;
  const seen = new Set<string>();
  for (const r of reports.filter(r => r.user_id === userId && r.report_date >= from && r.report_date <= to)) {
    const key = r.shift_id ?? r.id;
    if (seen.has(key)) continue;
    seen.add(key); result.worked += Math.max(0,Number(r.standard_hours)); result.ot15 += Math.max(0,Number(r.ot15_hours)); result.ot20 += Math.max(0,Number(r.ot20_hours)); result.sourceIds.push(r.id);
  }
  const yearStart = from.slice(0,4) + "-01-01";
  const relevant = leaves.filter(l => l.user_id === userId && l.status === "approved" && l.end_date >= yearStart && l.start_date <= to).sort((a,b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
  const absence = new Map<string,{ sick: number; paid: number; ids: string[] }>();
  for (const l of relevant) {
    const weekdays = datesBetween(l.start_date,l.end_date).filter(d => ![0,6].includes(new Date(d + "T00:00:00Z").getUTCDay()));
    if (!weekdays.length) continue;
    const daily = Math.max(0,Number(l.total_hours)) / weekdays.length;
    for (const date of weekdays.filter(d => d >= yearStart && d <= to)) {
      const item = absence.get(date) ?? { sick: 0, paid: 0, ids: [] };
      if (l.leave_type.toLowerCase() === "sick") item.sick += daily;
      else if (["annual", "training"].includes(l.leave_type.toLowerCase())) item.paid += daily;
      item.ids.push(l.id); absence.set(date,item);
    }
  }
  for (const [date, item] of [...absence].sort(([a],[b]) => a.localeCompare(b))) {
    const full = Math.min(item.sick,Math.max(0,wage.sick_full_hours-result.fullUsed));
    const half = Math.min(item.sick-full,Math.max(0,wage.sick_half_hours-result.halfUsed));
    result.fullUsed += full; result.halfUsed += half;
    if (date >= from) { result.leave += item.paid; result.sickFull += full; result.sickHalf += half; result.sickUnpaid += item.sick-full-half; result.sourceIds.push(...item.ids); }
  }
  for (const date of datesBetween(from,to)) {
    const version = [...rosters].filter(r => r.effective_from <= date).sort((a,b) => b.effective_from.localeCompare(a.effective_from))[0];
    if (!version || date < version.roster_start) continue;
    const cfg: StandbyConfig = { start: version.roster_start, rotationDays: version.rotation_days, perShift: version.per_shift, order: version.technician_order };
    if (standbyFor(date,cfg,swaps).includes(userId)) { result.standbyDays++; result.standbyPay += Number(policyOn(date,policies).standby_weekly_eur) / 7; }
  }
  result.normal = result.worked + result.leave + result.sickFull + result.sickHalf;
  result.standbyPay = money(result.standbyPay);
  result.sourceIds = [...new Set(result.sourceIds)];
  return result;
}
export function calculateWages(h: PayrollHours, rate: number, a: WageAdjustments) {
  if (![rate,a.bonus,a.tax,a.nationalInsurance,a.otherDeductions].every(v => Number.isFinite(v) && v >= 0)) throw new Error("Enter valid non-negative wage and deduction amounts.");
  const normalPay = money((h.worked+h.leave+h.sickFull)*rate), halfPay = money(h.sickHalf*rate*0.5);
  const ot15Pay = money(h.ot15*rate*1.5), ot20Pay = money(h.ot20*rate*2);
  const gross = money(normalPay+halfPay+ot15Pay+ot20Pay+h.standbyPay+a.bonus);
  const deductions = money(a.tax+a.nationalInsurance+a.otherDeductions);
  if (deductions > gross) throw new Error("Deductions cannot exceed gross pay.");
  return { normalPay, halfPay, ot15Pay, ot20Pay, gross, deductions, net: money(gross-deductions) };
}
export type PayslipSnapshot = { employee: string; employeeCode: string; company: string; taxReference: string; from: string; to: string; rate: number; hours: PayrollHours; adjustments: WageAdjustments; totals: ReturnType<typeof calculateWages>; notes: string };