import { formatMoney } from '@/lib/locale';
import { type PayslipSnapshot } from "@/lib/payroll";

export async function downloadPayslip(s: PayslipSnapshot, id: string) {
  const global=s.payrollMode==='universal_gross';
  const euros=(n:number)=>formatMoney(n,s.currency??'EUR');
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595,842]), y=794;
  const safe = (text: string) => text.replace(/€/g,"EUR ").replace(/[–—]/g,"-").replace(/[^\x20-\x7E\xA0-\xFF]/g,"?");
  const line = (left: string, right = "", heading=false) => {
    if(y<60){page=doc.addPage([595,842]);y=794;}
    page.drawText(safe(left).slice(0,78),{x:40,y,size:heading?14:10,font:heading?bold:font});
    if(right)page.drawText(safe(right),{x:440,y,size:10,font}); y-=heading?28:22;
  };
  line(s.company,"",true);line(global?"Gross Pay Summary":"Payslip - Malta","",true);
  if(s.detail)line(`PE Number: ${s.detail.peNumber || "-"}`);
  line(s.employee);line(`Employee reference: ${s.employeeCode || "-"}`);line(`Tax reference: ${s.taxReference || "-"}`);
  line(`Period: ${s.from} to ${s.to}`);line(`Payslip reference: ${id}`);line(`Hourly rate: ${euros(s.rate)}`);y-=12;
  line("Earnings","",true);
  const fullHours=s.hours.worked+s.hours.leave+s.hours.sickFull;
  line(`Normal full-pay hours (${fullHours.toFixed(2)} h)`,euros(s.totals.normalPay));
  line(`Worked ${s.hours.worked.toFixed(2)} h / paid leave ${s.hours.leave.toFixed(2)} h`);
  line(`Sick full pay ${s.hours.sickFull.toFixed(2)} h`);
  line(`Sick half pay (${s.hours.sickHalf.toFixed(2)} h)`,euros(s.totals.halfPay));
  line(`Overtime 1.5x (${s.hours.ot15.toFixed(2)} h)`,euros(s.totals.ot15Pay));
  line(`Overtime 2x (${s.hours.ot20.toFixed(2)} h)`,euros(s.totals.ot20Pay));
  line(`Standby allowance (${s.hours.standbyDays} days)`,euros(s.hours.standbyPay));
  if(s.detail){line("Housing allowance",euros(s.detail.config.housing));line("Food allowance",euros(s.detail.config.food));line("Scheduled bonus / supplement",euros(s.detail.automatic.bonus));line("Additional earnings",euros(s.adjustments.bonus-s.detail.automatic.bonus-s.detail.automatic.allowances));}else line("Other earnings / bonus",euros(s.adjustments.bonus));line("Gross pay",euros(s.totals.gross),true);
  if(!global){line("Deductions","",true);if(s.detail){line("Tax (FSS)",euros(s.detail.automatic.taxBasic));line("Tax on overtime",euros(s.detail.automatic.taxOvertime));line("Additional tax adjustment",euros(s.adjustments.tax-s.detail.automatic.tax));line(`NI contributions quantity: ${s.detail.automatic.mondays} Mondays`);}else line("Income tax (FSS) - office reviewed",euros(s.adjustments.tax));
  line("Employee national insurance - office reviewed",euros(s.adjustments.nationalInsurance));
  line("Other deductions",euros(s.adjustments.otherDeductions));line("Net pay",euros(s.totals.net),true);}
  line(`Unpaid sick leave: ${s.hours.sickUnpaid.toFixed(2)} h`);
  if(s.notes){line("Office notes","",true); for(const part of s.notes.match(/.{1,85}/g) ?? [])line(part);}
  if(s.detail){
    const d=s.detail;
    line("Employer contributions","",true);line("Employer SSC",euros(d.automatic.employerSsc));line("Maternity fund",euros(d.automatic.maternity));
    line("Vacation leave summary","",true);line("Entitled (hours)",d.leave.entitled.toFixed(2));line("Carried forward (hours)",d.leave.carried.toFixed(2));line("Consumed this month (hours)",d.leave.period.toFixed(2));line("Consumed total (hours)",d.leave.taken.toFixed(2));line("Balance (hours)",(d.leave.entitled+d.leave.carried-d.leave.taken).toFixed(2));line("Pending leave (hours)",d.leave.pending.toFixed(2));
    line("Year to date","",true);line("Gross pay",euros(d.ytd.gross));line("Tax",euros(d.ytd.tax));line("Employee NI",euros(d.ytd.ssc));line("Net pay",euros(d.ytd.net));
    line(`Tax status: ${d.config.taxStatus} / SSC: ${d.config.sscCategory}`);
    line("Annual statutory rates and employee eligibility reviewed by office.");
  } else line(global?"Gross earnings only. Local taxes, contributions and net pay not calculated.":"Statutory deductions entered and reviewed by the office.");
  const bytes=await doc.save(), url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:"application/pdf"}));
  const a=document.createElement("a");a.href=url;a.download=`${global?'Gross_Pay_Summary':'Payslip'}_${s.employee.replace(/[^\w-]/g,"_")}_${s.from}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}