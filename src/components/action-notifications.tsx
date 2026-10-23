import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, MessageSquare, CalendarClock, CalendarDays, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile, isManager } from '@/lib/profile';
import { useUnreadChatTotal, useChatReads, unreadByThread, type ChatMsg } from '@/lib/chat-unread';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
export function OnCallBadge({ userId }: { userId?: string | undefined }) {
 const q=useQuery({queryKey:['on-call-menu-badge',userId],enabled:!!userId,refetchInterval:15000,queryFn:async()=>{if(!userId)return 0;const r=await supabase.from('standby_swaps').select('id',{count:'exact',head:true}).eq('target_id',userId).eq('status','pending');if(r.error)throw r.error;return r.count??0;}});
 return q.data ? <span aria-label={`${q.data} incoming swap requests`} className="ml-auto rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{q.data}</span> : null;
}
export function ChatBadge({ userId }: { userId?: string | undefined }) {
 const n=useUnreadChatTotal(userId);
 return n ? <span aria-label={`${n} unread messages`} className="ml-auto rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{n}</span> : null;
}

/** Unread chat grouped per conversation, with a readable name for each. */
function useUnreadThreads(uid?: string) {
  const reads = useChatReads(uid);
  const q = useQuery({ queryKey: ['bell-threads', uid], enabled: !!uid, refetchInterval: 30000, queryFn: async () => {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const m = await supabase.from('internal_messages').select('sender_id,receiver_id,job_sheet_id,created_at').neq('sender_id', uid!).gte('created_at', since);
    if (m.error) throw m.error;
    const msgs = m.data as ChatMsg[];
    const ids = [...new Set(msgs.map(x => x.sender_id))];
    const sheetIds = [...new Set(msgs.map(x => x.job_sheet_id).filter(Boolean))] as string[];
    const [u, s] = await Promise.all([
      ids.length ? supabase.from('users').select('id,full_name').in('id', ids) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      sheetIds.length ? supabase.from('job_sheets').select('id,jobsheet_number').in('id', sheetIds) : Promise.resolve({ data: [] as { id: string; jobsheet_number: string | null }[] }),
    ]);
    const names = Object.fromEntries((u.data ?? []).map(x => [`user:${x.id}`, x.full_name]));
    for (const x of s.data ?? []) names[`job:${x.id}`] = `Job sheet #${x.jobsheet_number ?? ''}`;
    return { msgs, names };
  } });
  if (!uid || !reads.data || !q.data) return [];
  const counts = unreadByThread(q.data.msgs, reads.data, uid);
  return Object.entries(counts).map(([key, n]) => ({ key, n, name: q.data.names[key] ?? 'Conversation' }));
}

const Row = ({ icon: Icon, children }: { icon: typeof Bell; children: React.ReactNode }) => <span className="flex w-full items-center gap-2 text-left"><Icon className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{children}</span></span>;

export function ActionNotifications() {
  const { data:p }=useProfile();
  const threads=useUnreadThreads(p?.id);
  const manager=!!p&&isManager(p);
  const {data}=useQuery({queryKey:['action-notifications',p?.id],enabled:!!p,refetchInterval:15000,queryFn:async()=>{
    if(!p)return {incoming:0,approval:0,leave:0,problems:[] as {id:string;asset_id:string;problem:string}[]};
    const [incoming,approval,leave,problems]=await Promise.all([
      supabase.from('standby_swaps').select('id',{count:'exact',head:true}).eq('target_id',p.id).eq('status','pending'),
      manager?supabase.from('standby_swaps').select('id',{count:'exact',head:true}).eq('status','accepted').eq('manager_approved',false):Promise.resolve({count:0,error:null}),
      supabase.from('leave_requests').select('id',{count:'exact',head:true}).eq('consulted_supervisor_id',p.id).eq('status','pending').is('supervisor_response',null),
      manager?supabase.from('equipment_problem_reports').select('id,asset_id,problem').eq('status','open').order('created_at',{ascending:false}).limit(10):Promise.resolve({data:[],error:null}),
    ]);if(incoming.error||approval.error||leave.error)throw incoming.error||approval.error||leave.error;return {incoming:incoming.count??0,approval:approval.count??0,leave:leave.count??0,problems:problems.data??[]};
  }});
  const chat=threads.reduce((a,t)=>a+t.n,0);
  const problems=data?.problems??[];
  const count=chat+(data?.incoming??0)+(data?.approval??0)+(data?.leave??0)+problems.length;
  const item="h-auto w-full justify-start py-2";
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={`Pending actions: ${count}`}><Bell className="h-5 w-5"/>{count>0&&<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{count}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="max-h-[70vh] w-80 space-y-2 overflow-y-auto"><h2 className="font-medium">Pending actions</h2>{!count?<p className="text-sm text-muted-foreground">Nothing awaiting your attention.</p>:<>
    {threads.map(t=><Button key={t.key} asChild variant="outline" className={item}><Link to="/messages" search={{thread:t.key}}><Row icon={MessageSquare}>{t.name} · {t.n} new</Row></Link></Button>)}
    {problems.map(r=><Button key={r.id} asChild variant="outline" className={item}><Link to="/admin/jobs" search={{new:true,assetId:r.asset_id,problemId:r.id}}><Row icon={AlertTriangle}>Equipment problem: {r.problem}</Row></Link></Button>)}
    {!!data?.incoming&&<Button asChild variant="outline" className={item}><Link to="/standby"><Row icon={CalendarClock}>{data.incoming} on-call swap request(s)</Row></Link></Button>}
    {!!data?.approval&&<Button asChild variant="outline" className={item}><Link to="/standby"><Row icon={CalendarClock}>{data.approval} swap approval(s)</Row></Link></Button>}
    {!!data?.leave&&<Button asChild variant="outline" className={item}><Link to="/admin/leave"><Row icon={CalendarDays}>{data.leave} leave consultation(s)</Row></Link></Button>}
  </>}</PopoverContent></Popover>;
}
