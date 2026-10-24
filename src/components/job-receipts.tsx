import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {FileText,Camera,RotateCcw} from 'lucide-react';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {pendingReceipts,queueReceipt,syncReceipts,type QueuedReceipt} from '@/lib/receipt-queue';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {PhotoPdfScanner} from '@/components/photo-pdf-scanner';
import {ExpenseStash} from '@/components/expense-stash';
import {usePlanFeatures} from '@/lib/plan-features';
import {PdfReader} from '@/components/pdf-reader';
export function JobReceipts({userId,companyId,sheetId,readOnly}:{userId:string;companyId:string;sheetId:string;readOnly:boolean}){
 const qc=useQueryClient(),[stash,setStash]=useState(false),[scan,setScan]=useState(false),[local,setLocal]=useState<QueuedReceipt[]>([]),[view,setView]=useState<Blob|null>(null);
 const query=useQuery({queryKey:['receipts',sheetId],queryFn:async()=>{const r=await supabase.from('jobsheet_receipts').select('*').eq('jobsheet_id',sheetId).order('created_at');if(r.error)throw r.error;return r.data;}});
 useEffect(()=>{const refresh=()=>{void pendingReceipts(userId,sheetId).then(setLocal);void qc.invalidateQueries({queryKey:['receipts',sheetId]});};refresh();window.addEventListener('fieldops-receipts',refresh);return()=>window.removeEventListener('fieldops-receipts',refresh);},[userId,sheetId,qc]);
 const open=async(path:string,blob?:Blob)=>{if(blob){setView(blob);return;}const r=await supabase.storage.from('job-receipts').download(path);if(r.error||!r.data){toast.error(r.error?.message??'Receipt unavailable');return;}setView(r.data);};
 const attach=async(blob:Blob,pages:number)=>{if(readOnly)return;const id=crypto.randomUUID();await queueReceipt({id,company_id:companyId,jobsheet_id:sheetId,uploaded_by:userId,file_path:`${companyId}/${sheetId}/${id}.pdf`,page_count:pages,blob});if(navigator.onLine)await syncReceipts(userId);setScan(false);toast.success((await pendingReceipts(userId,sheetId)).length?'Receipt saved on this device — upload pending':'Receipt PDF attached');};
 const feature=usePlanFeatures();
 if(!feature("receipts"))return null;
 const ids=new Set(local.map(r=>r.id));
 return <section className="mx-auto mb-4 max-w-5xl space-y-3 rounded-lg border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">Receipts · internal only</h2>{!readOnly&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setStash(true)}>Attach from stash</Button><Button variant="outline" onClick={()=>setScan(true)}><Camera className="mr-2 h-4 w-4"/>Scan receipt</Button></div>}</div>{query.error&&<p role="alert" className="text-destructive">{query.error.message}</p>}<ul className="space-y-2">{(query.data??[]).filter(r=>!ids.has(r.id)).map((r,i)=><li key={r.id}><Button variant="ghost" onClick={()=>open(r.file_path)}><FileText className="mr-2 h-4 w-4"/>Receipt {i+1} · {r.page_count} pages</Button></li>)}{local.map((r,i)=><li key={r.id} className="flex flex-wrap gap-2"><Button variant="ghost" onClick={()=>open(r.file_path,r.blob)}><FileText className="mr-2 h-4 w-4"/>Local receipt {i+1}</Button><span className="self-center text-xs text-warning">{r.error??'Pending upload'}</span><Button variant="outline" size="icon" aria-label="Retry receipt upload" onClick={()=>syncReceipts(userId)}><RotateCcw className="h-4 w-4"/></Button></li>)}</ul><Dialog open={stash} onOpenChange={setStash}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Expense stash</DialogTitle></DialogHeader><ExpenseStash sheetId={sheetId} onAttached={()=>{setStash(false);void qc.invalidateQueries({queryKey:["receipts",sheetId]});}}/></DialogContent></Dialog><Dialog open={scan} onOpenChange={setScan}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Scan receipt</DialogTitle></DialogHeader><PhotoPdfScanner receipt onAttach={attach}/></DialogContent></Dialog><Dialog open={!!view} onOpenChange={o=>!o&&setView(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Receipt PDF</DialogTitle></DialogHeader>{view&&<PdfReader blob={view}/>}</DialogContent></Dialog></section>;
}
