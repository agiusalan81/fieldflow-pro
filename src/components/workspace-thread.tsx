import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Send} from 'lucide-react';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {useProfile} from '@/lib/profile';
import {workspaceMessageValid,type WorkspaceKind} from '@/lib/workspace-thread';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';

export function WorkspaceThread({kind,recordId,readOnly=false}:{kind:WorkspaceKind;recordId:string;readOnly?:boolean}){
 const {data:me}=useProfile(); const qc=useQueryClient(); const [body,setBody]=useState(''); const [busy,setBusy]=useState(false);
 const q=useQuery({queryKey:['workspace-thread',kind,recordId],refetchInterval:5000,queryFn:async()=>{
  const rows=[]; for(let offset=0;;offset+=500){const r=await supabase.from('workspace_thread_messages').select('*').eq('kind',kind).eq('record_id',recordId).order('created_at').order('id').range(offset,offset+499);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;} return rows;
 }});
 useEffect(()=>{if(!me||q.isPending||q.error)return; void supabase.from('workspace_thread_alerts').update({seen_at:new Date().toISOString()}).eq('kind',kind).eq('record_id',recordId).eq('recipient_id',me.id).is('seen_at',null).then(r=>{if(!r.error)void qc.invalidateQueries({queryKey:['workspace-alerts']});});},[kind,recordId,me?.id,q.data,q.isPending,q.error,qc]);
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(busy||readOnly||!workspaceMessageValid(body))return;setBusy(true);try{const r=await supabase.from('workspace_thread_messages').insert({kind,record_id:recordId,body:body.trim()});if(r.error)throw r.error;setBody('');await qc.invalidateQueries({queryKey:['workspace-thread',kind,recordId]});}catch(e){toast.error(e&&typeof e==='object'&&'message' in e?String(e.message):'Message could not be sent');}finally{setBusy(false);}};
 return <div className="space-y-3 border-t pt-3" onClick={e=>e.stopPropagation()}><h3 className="text-sm font-medium">Conversation</h3>
 {q.error?<p role="alert" className="text-sm text-destructive">Conversation could not be loaded.</p>:<div className="max-h-72 space-y-2 overflow-y-auto">{q.data?.map(m=><div key={m.id} className={`flex ${m.author_id===me?.id?'justify-end':'justify-start'}`}><div className={`max-w-[90%] rounded-md px-3 py-2 ${m.author_id===me?.id?'bg-primary text-primary-foreground':'bg-muted text-foreground'}`}><p className="text-xs font-medium">{m.author_name}</p><p className="whitespace-pre-wrap break-words text-sm">{m.body}</p><time className="text-[10px] opacity-75" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString()}</time></div></div>)}</div>}
 <form onSubmit={send} className="flex items-end gap-2"><Textarea aria-label="Conversation message" placeholder="Message" maxLength={4000} value={body} onChange={e=>setBody(e.target.value)} disabled={busy||readOnly} className="min-h-10 min-w-0"/><Button type="submit" size="icon" aria-label="Send conversation message" disabled={busy||readOnly||q.isPending||!!q.error||!workspaceMessageValid(body)} className="shrink-0"><Send className="h-4 w-4"/></Button></form></div>;
}