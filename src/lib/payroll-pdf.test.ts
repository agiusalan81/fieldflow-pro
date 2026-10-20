import {it,expect,vi} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {downloadPayslip} from './payroll-pdf';
import type {PayslipSnapshot} from './payroll';
it('creates a gross summary PDF without requiring country rates',async()=>{
 let blob:Blob|undefined;
 vi.spyOn(URL,'createObjectURL').mockImplementation(v=>{if(v instanceof Blob)blob=v;return 'blob:test';});
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 const s:PayslipSnapshot={payrollMode:'universal_gross',currency:'USD',employee:'Test',employeeCode:'E1',company:'Test company',taxReference:'',from:'2026-10-01',to:'2026-10-31',rate:10,hours:{worked:10,leave:0,sickFull:0,sickHalf:0,sickUnpaid:0,normal:10,ot15:0,ot20:0,standbyDays:0,standbyPay:0,fullUsed:0,halfUsed:0,sourceIds:[]},adjustments:{bonus:0,tax:0,nationalInsurance:0,otherDeductions:0},totals:{normalPay:100,halfPay:0,ot15Pay:0,ot20Pay:0,gross:100,deductions:0,net:100},notes:''};
 await downloadPayslip(s,'test');
 if(!blob)throw new Error('PDF was not generated');
 const bytes=await new Promise<ArrayBuffer>((resolve,reject)=>{const r=new FileReader();r.onload=()=>r.result instanceof ArrayBuffer?resolve(r.result):reject(new Error('No bytes'));r.onerror=reject;r.readAsArrayBuffer(blob as Blob);});
 const doc=await PDFDocument.load(bytes);expect(doc.getPageCount()).toBe(1);expect(bytes.byteLength).toBeGreaterThan(1000);
 vi.restoreAllMocks();
});
