import {describe,it,expect} from 'vitest';
import {universalPayroll, payrollMode, grossPayrollCsv} from './payroll-universal';
import {DEFAULT_EMPLOYEE} from './payroll-statutory';
import type {PayrollHours,PayslipSnapshot} from './payroll';
const h:PayrollHours={worked:10,leave:2,sickFull:1,sickHalf:2,sickUnpaid:0,normal:15,ot15:4,ot20:3,standbyDays:7,standbyPay:50,fullUsed:1,halfUsed:2,sourceIds:[]};
const wage={hourly_rate:10,sick_full_hours:8,sick_half_hours:8};
const calc=()=>universalPayroll(h,wage,DEFAULT_EMPLOYEE,'2026-10-01','2026-10-31',20);
describe('international gross payroll',()=>{
 it('pays standard hours at 1.0 times',()=>expect(calc().normalPay).toBe(130));
 it('pays overtime at 1.5 times',()=>expect(calc().ot15Pay).toBe(60));
 it('pays overtime at 2.0 times',()=>expect(calc().ot20Pay).toBe(60));
 it('includes standby and reviewed bonus in gross',()=>expect(calc().gross).toBe(330));
 it('does not calculate statutory deductions',()=>expect(calc().deductions).toBe(0));
 it('defaults new companies to universal gross',()=>expect(payrollMode(undefined)).toBe('universal_gross'));
 it('preserves Malta mode',()=>expect(payrollMode('statutory_malta')).toBe('statutory_malta'));
 it('does not double-pay salary leave',()=>{const x=universalPayroll({...h,sickHalf:0,ot15:0,ot20:0,standbyPay:0},wage,{...DEFAULT_EMPLOYEE,employment:'full_time',grossMonthly:2000},'2026-10-01','2026-10-31');expect(x.gross).toBe(2000);});
 it('rejects partial monthly salary periods',()=>expect(()=>universalPayroll(h,wage,{...DEFAULT_EMPLOYEE,employment:'full_time',grossMonthly:2000},'2026-10-02','2026-10-31')).toThrow('complete calendar month'));
 it('exports captured currency and gross earnings',()=>{const s:PayslipSnapshot={employee:'=BAD',employeeCode:'E1',company:'C',taxReference:'',from:'2026-10-01',to:'2026-10-31',rate:10,hours:h,adjustments:{bonus:20,tax:0,nationalInsurance:0,otherDeductions:0},totals:calc(),notes:'',currency:'USD',payrollMode:'universal_gross'};const csv=grossPayrollCsv([s]);expect(csv).toContain('"USD"');expect(csv).toContain('"330"');expect(csv).toContain('"\'=BAD"');});
});
