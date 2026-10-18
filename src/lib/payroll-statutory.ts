import { money, datesBetween, calculateWages, type PayrollHours, type WageSettings } from './payroll';
export const TAX_STATUSES = ['single','married','married_1','married_2','parent','parent_1','parent_2'] as const;
export type TaxStatus = typeof TAX_STATUSES[number];
export const TAX_LABELS: Record<TaxStatus,string> = { single:'Single', married:'Married', married_1:'Married · 1 child', married_2:'Married · 2+ children', parent:'Parent', parent_1:'Parent · 1 child', parent_2:'Parent · 2+ children' };
export type TaxBand = { to: number | null; rate: number; subtract: number; from?: number };
export type Contribution = { rate: number; fixed: number | null; cap: number | null };
export type SscRule = { employee: Contribution; employer: Contribution; maternity: Contribution };
export type StatutoryYear = { tax: Record<TaxStatus,TaxBand[]>; ssc: Record<string,SscRule>; lowWage: number; olderCap: number; newerCap: number; birthCutoff: string; overtimeTaxRate: number; weeksPerYear: number };
export type EmployeeConfig = { employment: 'hourly'|'full_time'|'part_time'|'casual'; grossMonthly: number; weeklyHours: number; taxStatus: TaxStatus | ''; sscCategory: string; birthDate: string; student: boolean; familyStatus: ''|'single'|'married'|'parent'; children: number; housing: number; food: number; bonuses: Record<string,number>; bonusEnabled: boolean; overtimeConcession: boolean; categoryBProRata: boolean; carriedForward: number; idCard: string };
export const DEFAULT_EMPLOYEE: EmployeeConfig = { employment:'hourly',grossMonthly:0,weeklyHours:40,taxStatus:'',sscCategory:'',birthDate:'',student:false,familyStatus:'',children:0,housing:0,food:0,bonuses:{'3':121.16,'6':135.10,'9':121.16,'12':135.10},bonusEnabled:false,overtimeConcession:false,categoryBProRata:false,carriedForward:0,idCard:'' };
export const SSC_DESCRIPTIONS: Record<string,string> = {
 A:'Under 18, weekly wage up to the A/B maximum. Fixed weekly employee and employer contribution with a small maternity share.',
 B:'18 or over, weekly wage up to the A/B maximum. Fixed weekly contribution; part-timers may elect the 10% pro-rata option.',
 C:'Standard rate: 10% of the basic weekly wage, between the minimum wage and the birth-group cap. Maternity is 0.3%.',
 D:'Weekly wage at or above the cap. Fixed weekly contribution that depends on the birth group (older/newer cutoff).',
 E:'Qualifying student-worker under 18: 10% of weekly wage, capped at a small fixed amount per week.',
 F:'Qualifying student-worker 18 or over: 10% of weekly wage, capped slightly higher than category E.',
};
const fixed=(n:number):Contribution=>({rate:0,fixed:n,cap:null});
const percent=(rate:number,cap:number|null=null):Contribution=>({rate,fixed:null,cap});
export function defaultStatutory(): StatutoryYear {
 const bands=(a:number,b:number,c:number,d:number,e:number):TaxBand[]=>[{to:a,rate:0,subtract:0},{to:b,rate:15,subtract:c},{to:60000,rate:25,subtract:d},{to:null,rate:35,subtract:e}];
 const ssc=(e:Contribution,m:Contribution):SscRule=>({employee:e,employer:{...e},maternity:m});
 return {tax:{single:bands(12000,16000,1800,3400,9400),married:bands(15000,23000,2250,4550,10550),married_1:bands(17500,26500,2625,5275,11275),married_2:bands(22500,32000,3375,6575,12575),parent:bands(13000,17500,1950,3700,9700),parent_1:bands(14500,21000,2175,4275,10275),parent_2:bands(18500,25500,2775,5325,11325)},ssc:{A:ssc(fixed(6.62),fixed(.20)),B:ssc(fixed(22.94),fixed(.69)),C:ssc(percent(10),percent(.3)),D_older:ssc(fixed(49.04),fixed(1.47)),D_newer:ssc(fixed(55.93),fixed(1.68)),E:ssc(percent(10,4.38),percent(.3,.13)),F:ssc(percent(10,7.94),percent(.3,.24))},lowWage:229.44,olderCap:490.38,newerCap:559.30,birthCutoff:'1961-12-31',overtimeTaxRate:15,weeksPerYear:52};
}
export function employeeConfig(v: unknown):EmployeeConfig { const p=v && typeof v==='object' && !Array.isArray(v)?v as Partial<EmployeeConfig>:{}; return {...DEFAULT_EMPLOYEE,...p,bonuses:{...DEFAULT_EMPLOYEE.bonuses,...p.bonuses}}; }
export function validStatutory(r:StatutoryYear) {
 if(!r || !Number.isFinite(r.weeksPerYear) || r.weeksPerYear<=0 || !/^\d{4}-\d{2}-\d{2}$/.test(r.birthCutoff))return false;
 if(![r.lowWage,r.olderCap,r.newerCap,r.overtimeTaxRate].every(n=>Number.isFinite(n)&&n>=0) || r.overtimeTaxRate>100)return false;
 if(!TAX_STATUSES.every(k=>{const bs=r.tax?.[k];return Array.isArray(bs)&&bs.length>0&&bs.every((b,i)=>{const from=b.from??(i===0?0:Number(bs[i-1]?.to));return Number.isFinite(b.rate)&&b.rate>=0&&b.rate<=100&&Number.isFinite(b.subtract)&&b.subtract>=0&&Number.isFinite(from)&&from>=0&&(i===bs.length-1?b.to===null:Number.isFinite(b.to)&&Number(b.to)>from);});}))return false;
 return ['A','B','C','D_older','D_newer','E','F'].every(k=>{const s=r.ssc?.[k];return s && [s.employee,s.employer,s.maternity].every(c=>c && [c.rate,c.fixed,c.cap].every(n=>n===null || Number.isFinite(n)&&n>=0)&&c.rate<=100);});
}
export function yearlyTax(income:number,status:TaxStatus,r:StatutoryYear){ const bs=r.tax[status];const b=bs.find((b,i)=>income>(b.from??(i===0?0:Number(bs[i-1]?.to)))&&(b.to===null||income<=b.to)); if(!b)throw new Error('Tax bands are incomplete');return money(Math.max(0,income*b.rate/100-b.subtract)); }
export function wageBasis(w:WageSettings,c:EmployeeConfig,r:StatutoryYear){const yearly=c.employment==='full_time'?c.grossMonthly*12:w.hourly_rate*c.weeklyHours*r.weeksPerYear;const weekly=yearly/r.weeksPerYear;return {yearly,monthly:yearly/12,weekly,hourly:c.employment==='full_time'?weekly/c.weeklyHours:w.hourly_rate};}
export function suggestCategories(c:EmployeeConfig,weekly:number,date:string,r:StatutoryYear):{tax:TaxStatus|'';ssc:string}{
 const kids=Math.min(2,Math.max(0,Math.floor(c.children)));const tax=c.familyStatus?(c.familyStatus==='single'?'single':`${c.familyStatus}${kids?'_'+kids:''}`) as TaxStatus:'';
 if(!c.birthDate || c.birthDate>date)return {tax,ssc:''};
 const born=new Date(c.birthDate+'T00:00:00Z'), at=new Date(date+'T00:00:00Z');let age=at.getUTCFullYear()-born.getUTCFullYear();if(date.slice(5)<c.birthDate.slice(5))age--;
 const cap=c.birthDate<=r.birthCutoff?r.olderCap:r.newerCap;
 return {tax,ssc:c.student?(age<18?'E':'F'):weekly<=r.lowWage?(age<18?'A':'B'):weekly<=cap?'C':'D'};
}
export function contribution(weekly:number,c:Contribution){return money(c.fixed===null?Math.min(weekly*c.rate/100,c.cap??Infinity):c.fixed);}
export function sscPerMonday(weekly:number,c:EmployeeConfig,r:StatutoryYear){
 const key=c.sscCategory==='D'?(c.birthDate<=r.birthCutoff?'D_older':'D_newer'):c.sscCategory;
 if(!c.birthDate || !r.ssc[key])throw new Error('Set birth date and SSC category');const s=r.ssc[key];if(!s)throw new Error('SSC category is missing');
 return {employee:c.sscCategory==='B'&&c.categoryBProRata?money(weekly*.1):contribution(weekly,s.employee),employer:contribution(weekly,s.employer),maternity:contribution(weekly,s.maternity)};
}
export function countMondays(from:string,to:string){return datesBetween(from,to).filter(d=>new Date(d+'T00:00:00Z').getUTCDay()===1).length;}
/** Extra leave credit (hours) for public holidays that fall on a non-working day, per Malta rules. */
export function weekendHolidayCredit(publicHolidays:string[],workDays:number[],year:number,dailyHours=8){
 return publicHolidays.filter(d=>d.slice(0,4)===String(year)&&!workDays.includes(new Date(d+'T00:00:00Z').getUTCDay())).length*dailyHours;
}
export function monthlyPayroll(h:PayrollHours,w:WageSettings,c:EmployeeConfig,r:StatutoryYear,from:string,to:string,extraTaxable=0){
 if(!Number.isFinite(extraTaxable)||extraTaxable<0)throw new Error("Enter valid additional earnings");
 if(!validStatutory(r))throw new Error('Review and save valid statutory rates for this year');
 const last=new Date(from.slice(0,7)+'-01T00:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
 if(from.slice(8)!=='01'||to!==last.toISOString().slice(0,10))throw new Error('Choose a complete calendar month for automatic payroll');
 if(!c.taxStatus || !c.sscCategory)throw new Error('Confirm employee tax and SSC categories');
 const basis=wageBasis(w,c,r);if(basis.hourly<=0 || c.weeklyHours<=0)throw new Error('Set a positive wage and weekly hours');
 const hourly=calculateWages(h,basis.hourly,{bonus:0,tax:0,nationalInsurance:0,otherDeductions:0});
 // Salary includes paid leave and full sick leave; never add the same absence twice.
 const normalPay=c.employment==='full_time'?money(Math.max(0,c.grossMonthly-(h.sickHalf+h.sickUnpaid)*basis.hourly)):hourly.normalPay;
 const halfPay=hourly.halfPay;
 const bonus=c.bonusEnabled?Number(c.bonuses[String(Number(from.slice(5,7)))]??0):0;
 const allowances=money(c.housing+c.food), overtime=money(hourly.ot15Pay+hourly.ot20Pay);
 const annualChargeable=(normalPay+halfPay+allowances+extraTaxable)*12+Object.values(c.bonuses).reduce((s,n)=>s+(c.bonusEnabled?n:0),0)+(c.overtimeConcession?0:overtime*12);
 const taxYearly=yearlyTax(annualChargeable,c.taxStatus,r), taxBasic=money(taxYearly/12), taxOvertime=c.overtimeConcession?money(overtime*r.overtimeTaxRate/100):0;
 const ssc=sscPerMonday(c.employment==='full_time'?basis.weekly:(hourly.normalPay+hourly.halfPay)*7/datesBetween(from,to).length,c,r),mondays=countMondays(from,to);
 const nationalInsurance=money(ssc.employee*mondays),tax=money(taxBasic+taxOvertime);
 const gross=money(normalPay+halfPay+overtime+allowances+bonus+h.standbyPay+extraTaxable),deductions=money(tax+nationalInsurance);
 if(deductions>gross)throw new Error('Calculated deductions exceed gross pay; review employee setup');
 return {normalPay,halfPay,ot15Pay:hourly.ot15Pay,ot20Pay:hourly.ot20Pay,gross,deductions,net:money(gross-deductions),basis,bonus,allowances,taxYearly,taxBasic,taxOvertime,tax,nationalInsurance,mondays,ssc,employerSsc:money(ssc.employer*mondays),maternity:money(ssc.maternity*mondays)};
}
