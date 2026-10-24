import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {toast} from 'sonner';
import {MessageSquarePlus,Lock} from 'lucide-react';
export function JobsheetInternalNotes({sheetId,userId,companyId}:{sheetId:string;userId:string;companyId:string}){
 const [body,setBody]=useState(''),[busy,setBusy]=useState(false),qc=useQueryClient();
 const key=['sheet-internal-notes',userId,sheetId];
 const notes=useQuery({queryKey:key,queryFn:async()=>{const r=await supabase.from('jobsheet_internal_notes').select('*').eq('jobsheet_id',sheetId).order('created_at');if(r.error)throw r.error;return r.data;}});
 const add=async()=>{setBusy(true);try{const r=await supabase.from('jobsheet_internal_notes').insert({company_id:companyId,jobsheet_id:sheetId,author_id:userId,body:body.trim()});if(r.error)throw r.error;setBody('');await qc.invalidateQueries({queryKey:key});toast.success('Internal comment added');}catch(e){toast.error(e instanceof Error?e.message:'Could not add comment');}finally{setBusy(false);}};
 return <section className="mx-auto mb-4 max-w-5xl space-y-3 border-t py-4"><h2 className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4"/>Internal comments · office only</h2>{notes.error&&<p role="alert" className="text-destructive">{notes.error.message}</p>}{notes.data?.map(n=><div key={n.id} className="border-l-2 pl-3"><p className="whitespace-pre-wrap break-words text-sm">{n.body}</p><p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p></div>)}<Textarea aria-label="Additional internal comment" rows={3} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/><Button disabled={busy||!body.trim()} onClick={add}><MessageSquarePlus className="mr-2 h-4 w-4"/>Add internal comment</Button></section>;
}
