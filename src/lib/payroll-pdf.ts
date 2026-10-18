import { euros, type PayslipSnapshot } from "@/lib/payroll";

export async function downloadPayslip(s: PayslipSnapshot, id: string) {
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
  line(s.company,"",true);line("Payslip - Malta","",true);
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
  line("Other earnings / bonus",euros(s.adjustments.bonus));line("Gross pay",euros(s.totals.gross),true);
  line("Deductions","",true);line("Income tax (FSS) - office reviewed",euros(s.adjustments.tax));
  line("Employee national insurance - office reviewed",euros(s.adjustments.nationalInsurance));
  line("Other deductions",euros(s.adjustments.otherDeductions));line("Net pay",euros(s.totals.net),true);
  line(`Unpaid sick leave: ${s.hours.sickUnpaid.toFixed(2)} h`);
  if(s.notes){line("Office notes","",true); for(const part of s.notes.match(/.{1,85}/g) ?? [])line(part);}
  line("Statutory deductions entered and reviewed by the office.");
  const bytes=await doc.save(), url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:"application/pdf"}));
  const a=document.createElement("a");a.href=url;a.download=`Payslip_${s.employee.replace(/[^\w-]/g,"_")}_${s.from}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}