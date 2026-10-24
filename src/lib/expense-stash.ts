import { openDB } from 'idb';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
export type ExpenseDraft = { id:string; company_id:string; uploaded_by:string; file_path:string; page_count:number; created_at:string; blob:Blob; error?:string };
const db = () => openDB('fieldbridge-expenses',1,{upgrade(d){d.createObjectStore('receipts',{keyPath:'id'});}});
const changed = () => window.dispatchEvent(new Event('fieldbridge-expenses'));
export async function localExpenses(userId:string):Promise<ExpenseDraft[]>{return (await (await db()).getAll('receipts')).filter(r=>r.uploaded_by===userId);}
export async function stashExpense(userId:string,companyId:string,blob:Blob,pages:number){
 if(blob.size>20*1024*1024)throw new Error('Receipt PDF must be under 20 MB.');
 const id=crypto.randomUUID();
 await (await db()).put('receipts',{id,company_id:companyId,uploaded_by:userId,file_path:`${companyId}/expenses/${id}.pdf`,page_count:pages,created_at:new Date().toISOString(),blob});changed();
}
const running=new Set<string>();
export async function syncExpenses(userId:string){
 if(running.has(userId)||!navigator.onLine)return;
 running.add(userId);
 try{
 const identity=await supabase.auth.getUser();if(identity.data.user?.id!==userId)throw new Error('Sign in to the account that saved these receipts.');
 for(const receipt of await localExpenses(userId)){
 try{
 const {blob,error:_error,...row}=receipt;
 const existing=await supabase.from('expense_receipts').select('id').eq('id',row.id).maybeSingle();if(existing.error)throw existing.error;
 if(!existing.data){const r=await supabase.from('expense_receipts').insert(row);if(r.error)throw r.error;}
 const upload=await supabase.storage.from('job-receipts').upload(row.file_path,blob,{contentType:'application/pdf',upsert:false});
 if(upload.error&&!/already exists|Duplicate/i.test(upload.error.message))throw upload.error;
 await (await db()).delete('receipts',row.id);
 }catch(e){await (await db()).put('receipts',{...receipt,error:e instanceof Error?e.message:'Upload failed'});}
 }
 }finally{running.delete(userId);changed();}
}
export async function attachExpense(expense:{id:string;company_id:string;file_path:string;page_count:number},sheetId:string,userId:string){
 const r=await supabase.from('jobsheet_receipts').insert({company_id:expense.company_id,jobsheet_id:sheetId,uploaded_by:userId,file_path:expense.file_path,page_count:expense.page_count,expense_id:expense.id});if(r.error)throw r.error;
}
export function monthBounds(month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Choose a month.');
 const [year,m]=month.split('-').map(Number);if(year===undefined||m===undefined)throw new Error('Choose a month.');
 return {start:`${month}-01T00:00:00.000Z`,end:new Date(Date.UTC(year,m,1)).toISOString()};
}
export async function combineReceiptPdfs(blobs:Blob[]){
 if(!blobs.length)throw new Error('No receipts for this month.');
 const output=await PDFDocument.create();
 for(const blob of blobs){const pdf=await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));for(const page of await output.copyPages(pdf,pdf.getPageIndices()))output.addPage(page);}
 return new Blob([new Uint8Array(await output.save())],{type:'application/pdf'});
}
