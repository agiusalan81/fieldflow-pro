import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Settings, Megaphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyUsers, useProfile, isManager } from '@/lib/profile';
import { pushChatMessages } from '@/lib/web-push';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function useChatChannels() {
  return useQuery({queryKey:['chat-channels'],refetchInterval:15000,queryFn:async()=>{const r=await supabase.from('message_channels').select('id,name').eq('archived',false).order('name');if(r.error)throw r.error;return r.data;}});
}

export function ChatChannelControls({ channelId }: {channelId?:string}) {
  const {data:p}=useProfile();
  const {data:users=[]}=useCompanyUsers();
  const {data:channels=[]}=useChatChannels();
  const qc=useQueryClient();
  const [editor,setEditor]=useState(false),[broadcast,setBroadcast]=useState(false),[busy,setBusy]=useState(false);
  const [id,setId]=useState<string|null>(null),[name,setName]=useState(''),[members,setMembers]=useState<string[]>([]),[target,setTarget]=useState(''),[text,setText]=useState('');
  const active=users.filter(u=>u.registration_status==='active');
  const load=async(edit:boolean)=>{
    setId(edit&&channelId?channelId:null);setName(edit?channels.find(c=>c.id===channelId)?.name??'':'');setMembers([]);
    if(edit&&channelId){const r=await supabase.from('message_channel_members').select('user_id').eq('channel_id',channelId);if(r.error){toast.error(r.error.message);return;}setMembers(r.data.map(m=>m.user_id));}
    setEditor(true);
  };
  const save=async(archive=false)=>{
    if(busy)return;if(archive&&!window.confirm('Archive this channel? Its message history will be retained.'))return;
    setBusy(true);try{const r=await supabase.rpc('save_message_channel',{_id:id as never,_name:name,_members:members,_archived:archive});if(r.error)throw r.error;setEditor(false);await qc.invalidateQueries({queryKey:['chat-channels']});toast.success(archive?'Channel archived':'Channel saved');}catch(e){toast.error(e instanceof Error?e.message:'Channel could not be saved');}finally{setBusy(false);}
  };
  const send=async()=>{
    if(busy)return;setBusy(true);try{const r=await supabase.rpc('broadcast_message_channel',{_channel:target,_text:text});if(r.error)throw r.error;const ids=r.data??[];for(let n=0;n<ids.length;n+=20)pushChatMessages(ids.slice(n,n+20));toast.success(`Announcement sent to ${ids.length} colleagues`);setText('');setBroadcast(false);void qc.invalidateQueries({queryKey:['messages']});}catch(e){toast.error(e instanceof Error?e.message:'Announcement could not be sent');}finally{setBusy(false);}
  };
  if(!isManager(p))return null;
  return <>
    <div className="flex flex-wrap gap-1 border-b p-2">
      <Button size="sm" variant="ghost" onClick={()=>void load(false)}><Plus className="mr-1 h-4 w-4"/>Channel</Button>
      {channelId&&<Button size="icon" variant="ghost" aria-label="Manage channel" title="Manage channel" onClick={()=>void load(true)}><Settings className="h-4 w-4"/></Button>}
      <Button size="sm" variant="ghost" disabled={!channels.length} onClick={()=>{setTarget(channelId??channels[0]?.id??'');setBroadcast(true);}}><Megaphone className="mr-1 h-4 w-4"/>Broadcast</Button>
    </div>
    <Dialog open={editor} onOpenChange={v=>{if(!busy)setEditor(v);}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{id?'Manage channel':'New channel'}</DialogTitle></DialogHeader>
      <Label htmlFor="channel-name">Channel name</Label><Input id="channel-name" value={name} maxLength={80} onChange={e=>setName(e.target.value)}/>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setMembers(active.map(u=>u.id))}>All active staff</Button><Button size="sm" variant="outline" onClick={()=>setMembers(active.filter(u=>['technician','maintenance'].includes(u.role)).map(u=>u.id))}>All field staff</Button><Button size="sm" variant="ghost" onClick={()=>setMembers([])}>Clear</Button></div>
      <fieldset className="max-h-72 space-y-2 overflow-y-auto"><legend className="mb-2 text-sm font-medium">Members ({members.filter(id=>active.some(u=>u.id===id)).length})</legend>{active.map(u=><label key={u.id} className="flex min-h-10 items-center gap-2"><Checkbox checked={members.includes(u.id)} onCheckedChange={v=>setMembers(v===true?[...members,u.id]:members.filter(id=>id!==u.id))}/><span className="text-sm">{u.full_name}</span></label>)}</fieldset>
      <DialogFooter>{id&&<Button variant="destructive" disabled={busy} onClick={()=>void save(true)}>Archive</Button>}<Button variant="outline" disabled={busy} onClick={()=>setEditor(false)}>Cancel</Button><Button disabled={busy||!name.trim()} onClick={()=>void save()}>Save channel</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={broadcast} onOpenChange={v=>{if(!busy)setBroadcast(v);}}><DialogContent><DialogHeader><DialogTitle>Broadcast announcement</DialogTitle></DialogHeader>
      <Label>Recipient group</Label><Select value={target} onValueChange={setTarget}><SelectTrigger aria-label="Recipient group"><SelectValue/></SelectTrigger><SelectContent>{channels.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Label htmlFor="broadcast-text">Announcement</Label><Textarea id="broadcast-text" value={text} maxLength={4000} onChange={e=>setText(e.target.value)}/>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setBroadcast(false)}>Cancel</Button><Button disabled={busy||!target||!text.trim()} onClick={()=>void send()}><Megaphone className="mr-1 h-4 w-4"/>{busy?'Sending…':'Send broadcast'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}