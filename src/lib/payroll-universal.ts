import { calculateWages, money, validPayrollPeriod, type PayrollHours, type WageSettings, type PayslipSnapshot } from './payroll';
import type { EmployeeConfig } from './payroll-statutory';
export type PayrollMode = 'universal_gross' | 'statutory_malta';
export function payrollMode(value: unknown): PayrollMode { return value === 'statutory_malta' ? value : 'universal_gross'; }
export function universalBasis(w: WageSettings, c: EmployeeConfig) {
  if (![w.hourly_rate,c.grossMonthly,c.weeklyHours].every(n=>Number.isFinite(n)&&n>=0) || c.weeklyHours<=0) throw new Error('Set valid wages and positive weekly hours');
  const yearly=c.employment==='full_time'?c.grossMonthly*12:w.hourly_rate*c.weeklyHours*52;
  return {yearly,monthly:yearly/12,weekly:yearly/52,hourly:c.employment==='full_time'?yearly/52/c.weeklyHours:w.hourly_rate};
}
/** Gross only: local accountants handle taxes, social contributions and net pay. */
export function universalPayroll(h: PayrollHours,w: WageSettings,c: EmployeeConfig,from:string,to:string,bonus=0) {
  if (!validPayrollPeriod(from,to)) throw new Error('Choose a valid payroll period');
  if (!Object.values(h).filter(v=>typeof v==='number').every(v=>Number.isFinite(v)&&v>=0)) throw new Error('Invalid payroll hours');
  const basis=universalBasis(w,c);
  if (basis.hourly<=0) throw new Error('Set a positive employee wage');
  const hourly=calculateWages(h,basis.hourly,{bonus,tax:0,nationalInsurance:0,otherDeductions:0});
  if(c.employment!=='full_time')return {...hourly,basis};
  const last=new Date(from.slice(0,7)+'-01T00:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
  if(from.slice(8)!=='01'||to!==last.toISOString().slice(0,10))throw new Error('Monthly salaries require a complete calendar month');
  const normalPay=money(Math.max(0,c.grossMonthly-(h.sickHalf+h.sickUnpaid)*basis.hourly));
  const gross=money(normalPay+hourly.halfPay+hourly.ot15Pay+hourly.ot20Pay+h.standbyPay+bonus);
  return {...hourly,normalPay,gross,net:gross,basis};
}
export function grossPayrollCsv(summaries: PayslipSnapshot[]) {
  const cells=(row:unknown[])=>row.map(v=>`"${String(v).replace(/^[=+@-]/,"'").replace(/"/g,'""')}"`).join(',');
  return [cells(['Employee','Employee reference','From','To','Currency','Worked hours','Paid leave hours','Sick full hours','Sick half hours','OT 1.5 hours','OT 2 hours','Basic earnings','Half sick earnings','OT 1.5 earnings','OT 2 earnings','Standby allowance','Other earnings','Gross earnings']),...summaries.map(s=>cells([s.employee,s.employeeCode,s.from,s.to,s.currency??'EUR',s.hours.worked,s.hours.leave,s.hours.sickFull,s.hours.sickHalf,s.hours.ot15,s.hours.ot20,s.totals.normalPay,s.totals.halfPay,s.totals.ot15Pay,s.totals.ot20Pay,s.hours.standbyPay,s.adjustments.bonus,s.totals.gross]))].join('\r\n');
}
