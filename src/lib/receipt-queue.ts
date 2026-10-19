import {openDB} from 'idb';
import {supabase} from '@/integrations/supabase/client';
export type QueuedReceipt={id:string;company_id:string;jobsheet_id:string;uploaded_by:string;file_path:string;page_count:number;blob:Blob;error?:string};
const database=()=>openDB('fieldops-receipts',1,{upgrade(d){d.createObjectStore('receipts',{keyPath:'id'});}});
export async function pendingReceipts(userId:string,sheetId?:string):Promise<QueuedReceipt[]>{return (await(await database()).getAll('receipts')).filter(r=>r.uploaded_by===userId&&(!sheetId||r.jobsheet_id===sheetId));}
export async function queueReceipt(r:QueuedReceipt){if(r.blob.size>20*1024*1024)throw new Error('Receipt PDF must be under 20 MB.');await(await database()).put('receipts',r);window.dispatchEvent(new Event('fieldops-receipts'));}
const running=new Set<string>();
export async function syncReceipts(userId:string){
 if(running.has(userId))return;running.add(userId);try{
 if(!navigator.onLine)return;const{data:auth}=await supabase.auth.getUser();if(auth.user?.id!==userId)throw new Error('Sign into the account that scanned these receipts.');
 for(const r of await pendingReceipts(userId)){try{
 const{blob,error:_error,...row}=r;
 const existing=await supabase.from('jobsheet_receipts').select('id').eq('id',r.id).maybeSingle();if(existing.error)throw existing.error;
 if(!existing.data){const insert=await supabase.from('jobsheet_receipts').insert(row);if(insert.error)throw insert.error;}
 const uploaded=await supabase.storage.from('job-receipts').upload(r.file_path,blob,{contentType:'application/pdf',upsert:false});if(uploaded.error&&!/already exists|Duplicate/i.test(uploaded.error.message))throw uploaded.error;
 await(await database()).delete('receipts',r.id);
 }catch(e){await(await database()).put('receipts',{...r,error:e instanceof Error?e.message:'Upload failed'});}}
 window.dispatchEvent(new Event('fieldops-receipts'));
 }finally{running.delete(userId);}
}
