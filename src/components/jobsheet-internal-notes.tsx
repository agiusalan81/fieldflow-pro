import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {VoiceDictation} from '@/components/voice-dictation';
import {toast} from 'sonner';
import {MessageSquarePlus,Lock} from 'lucide-react';

export const internalNotesKey=(sheetId:string)=>['sheet-internal-notes',sheetId];
export function useInternalNotes(sheetId:string){
 return useQuery({queryKey:internalNotesKey(sheetId),queryFn:async()=>{const r=await supabase.from('jobsheet_internal_notes').select('*').eq('jobsheet_id',sheetId).order('created_at');if(r.error)throw r.error;return r.data;}});
}

/** One internal thread: the comment written before signing opens it, later additions append beneath. */
export function InternalThread({sheetId,initial,initialAt}:{sheetId:string;initial?:string|null;initialAt?:string|null}){
 const notes=useInternalNotes(sheetId);
 const first=initial?.trim();
 if(!first&&!notes.data?.length&&!notes.error)return null;
 return <div className="space-y-2">{notes.error&&<p role="alert" className="text-destructive">{notes.error.message}</p>}
  {first&&<div className="border-l-2 border-primary pl-3"><p className="whitespace-pre-wrap break-words text-sm">{first}</p><p className="text-xs text-muted-foreground">Site comment before signing{initialAt?` · ${new Date(initialAt).toLocaleString()}`:''}</p></div>}
  {notes.data?.map(n=><div key={n.id} className="border-l-2 pl-3"><p className="whitespace-pre-wrap break-words text-sm">{n.body}</p><p className="text-xs text-muted-foreground">Added {new Date(n.created_at).toLocaleString()}</p></div>)}
 </div>;
}

export function JobsheetInternalNotes({sheetId,userId,companyId,initial,initialAt}:{sheetId:string;userId:string;companyId:string;initial?:string|null;initialAt?:string|null}){
 const [body,setBody]=useState(''),[busy,setBusy]=useState(false),qc=useQueryClient();
 const add=async()=>{setBusy(true);try{const r=await supabase.from('jobsheet_internal_notes').insert({company_id:companyId,jobsheet_id:sheetId,author_id:userId,body:body.trim()});if(r.error)throw r.error;setBody('');await qc.invalidateQueries({queryKey:internalNotesKey(sheetId)});toast.success('Internal comment added');}catch(e){toast.error(e instanceof Error?e.message:'Could not add comment');}finally{setBusy(false);}};
 return <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-medium"><Lock className="h-4 w-4"/>Internal comments · office only</h3>
  <InternalThread sheetId={sheetId} initial={initial} initialAt={initialAt}/>
  <Textarea aria-label="Additional internal comment" rows={3} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/>
  <VoiceDictation label="internal comment" disabled={busy} value={body} onApply={setBody}/>
  <Button disabled={busy||!body.trim()} onClick={add}><MessageSquarePlus className="mr-2 h-4 w-4"/>Add internal comment</Button></section>;
}
