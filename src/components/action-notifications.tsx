import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, MessageSquare, CalendarClock, CalendarDays, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile, isManager, isOffice } from '@/lib/profile';
import { usePlanFeatures } from '@/lib/plan-features';
import { useCan } from '@/lib/permissions';
import { useUnreadChatTotal, useChatReads, unreadByThread, type ChatMsg } from '@/lib/chat-unread';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
export function OnCallBadge({ userId }: { userId?: string | undefined }) {
 const on=usePlanFeatures(!!userId);
 const q=useQuery({queryKey:['on-call-menu-badge',userId,on('standby')],enabled:!!userId&&on('standby'),refetchInterval:15000,queryFn:async()=>{if(!userId)return 0;const r=await supabase.from('standby_swaps').select('id',{count:'exact',head:true}).eq('target_id',userId).eq('status','pending').or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`);if(r.error)throw r.error;return r.count??0;}});
 return on('standby')&&q.data ? <span aria-label={`${q.data} incoming swap requests`} className="ml-auto rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{q.data}</span> : null;
}
export function ChatBadge({ userId }: { userId?: string | undefined }) {
 const n=useUnreadChatTotal(userId);
 return n ? <span aria-label={`${n} unread messages`} className="ml-auto rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{n}</span> : null;
}

/** Unread chat grouped per conversation, with a readable name for each. */
function useUnreadThreads(uid?: string) {
  const reads = useChatReads(uid);
  const q = useQuery({ queryKey: ['bell-threads', uid], enabled: !!uid, refetchInterval: 30000, queryFn: async () => {
    if (!uid) return { msgs: [] as ChatMsg[], names: {} as Record<string,string> };
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const m = await supabase.from('internal_messages').select('sender_id,receiver_id,job_sheet_id,created_at').neq('sender_id', uid).gte('created_at', since);
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
  const on=usePlanFeatures(!!p),can=useCan(p);
  const core=on('core'),standby=on('standby');
  const threads=useUnreadThreads(core?p?.id:undefined);
  const manager=!!p&&isManager(p);
  const catsOn=!!p&&on('receipts')&&['admin','superuser','supervisor'].includes(p.role),leaveOn=core&&can('leave_approvals'),problemsOn=core&&manager&&can('pending_works');
  const surveysOn=!!p&&on('site_surveys')&&manager;
  const surveys=useQuery({queryKey:['action-notifications','surveys',p?.id,surveysOn],enabled:surveysOn,refetchInterval:15000,queryFn:async()=>{if(!p)return [];const r=await supabase.from('site_surveys').select('id,location_ref,reviewer_id').in('status',['submitted','under_review']).or(`reviewer_id.eq.${p.id},reviewer_id.is.null`).order('submitted_at',{ascending:true}).limit(20);if(r.error)throw r.error;return r.data;}}).data??[];
  const quotesOn=core&&manager;
  const decided=useQuery({queryKey:['action-notifications','quote-decisions',p?.id,quotesOn],enabled:quotesOn,refetchInterval:15000,queryFn:async()=>{const r=await supabase.from('customer_quotes').select('id,reference,status').in('status',['accepted','declined']).is('office_seen_at',null).order('decided_at',{ascending:false}).limit(20);if(r.error)throw r.error;return r.data;}}).data??[];
  const {data}=useQuery({queryKey:['action-notifications',p?.id,core,standby,leaveOn,problemsOn,catsOn],enabled:!!p,refetchInterval:15000,queryFn:async()=>{
    if(!p)return {categories:[] as {id:string;name:string}[],incoming:[] as {id:string}[],approval:[] as {id:string}[],leave:[] as {id:string}[],responses:[] as {id:string}[],problems:[] as {id:string;asset_id:string;problem:string}[]};
    const zero=Promise.resolve({count:0,data:[],error:null});
    const empty=Promise.resolve({data:[] as {id:string}[],error:null});
    const [incoming,approval,leave,problems,responses,cats]=await Promise.all([
      standby?supabase.from('standby_swaps').select('id').eq('target_id',p.id).eq('status','pending').or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`):empty,
      standby&&manager?supabase.from('standby_swaps').select('id').eq('status','accepted').eq('manager_approved',false):empty,
      leaveOn?supabase.from('leave_requests').select('id').eq('consulted_supervisor_id',p.id).eq('status','pending').is('supervisor_response',null):empty,
      problemsOn?supabase.from('equipment_problem_reports').select('id,asset_id,problem').eq('status','open').order('created_at',{ascending:false}).limit(10):Promise.resolve({data:[],error:null}),
      leaveOn&&isOffice(p)?supabase.from('leave_requests').select('id').eq('status','pending').not('supervisor_response','is',null):empty,
      catsOn?supabase.from('expense_categories').select('id,name').eq('status','pending').limit(20):zero,
    ]);if(incoming.error||approval.error||leave.error||responses.error)throw incoming.error||approval.error||leave.error||responses.error;return {categories:(cats.data??[]) as {id:string;name:string}[],incoming:incoming.data??[],approval:approval.data??[],leave:leave.data??[],responses:responses.data??[],problems:problems.data??[]};
  }});
  const chat=threads.reduce((a,t)=>a+t.n,0);
  const problems=data?.problems??[];
  const count=decided.length+surveys.length+chat+(data?.incoming.length??0)+(data?.approval.length??0)+(data?.leave.length??0)+(data?.responses.length??0)+problems.length+(data?.categories.length??0);
  const [open,setOpen]=useState(false);
  const item="h-auto w-full justify-start py-2";
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={`Pending actions: ${count}`}><Bell className="h-5 w-5"/>{count>0&&<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{count}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="max-h-[70vh] w-80 space-y-2 overflow-y-auto" onClick={(e)=>{if((e.target as HTMLElement).closest('a'))setOpen(false);}}><h2 className="font-medium">Pending actions</h2>{!count?<p className="text-sm text-muted-foreground">Nothing awaiting your attention.</p>:<>
    {threads.map(t=><Button key={t.key} asChild variant="outline" className={item}><Link to="/messages" search={{thread:t.key}}><Row icon={MessageSquare}>{t.name} · {t.n} new</Row></Link></Button>)}
    {decided.map(v=><Button key={v.id} asChild variant="outline" className={item}><Link to="/estimates" search={{quote:v.id}}><Row icon={AlertTriangle}>Client {v.status} quote {v.reference}</Row></Link></Button>)}
    {surveys.map(v=><Button key={v.id} asChild variant="outline" className={item}><Link to="/surveys" search={{survey:v.id}}><Row icon={AlertTriangle}>Site survey to review{v.location_ref?`: ${v.location_ref}`:''}{v.reviewer_id?' (assigned to you)':''}</Row></Link></Button>)}
    {problems.map(r=><Button key={r.id} asChild variant="outline" className={item}><Link to="/admin/jobs" search={{new:true,assetId:r.asset_id,problemId:r.id}}><Row icon={AlertTriangle}>Equipment problem: {r.problem}</Row></Link></Button>)}
    {data?.categories.map(c=><Button key={c.id} asChild variant="outline" className={item}><Link to="/admin/approvals" search={{category:"expenses",item:c.id}}><Row icon={AlertTriangle}>Expense category to approve: {c.name}</Row></Link></Button>)}
    {data?.incoming.map(s=><Button key={s.id} asChild variant="outline" className={item}><Link to="/standby" search={{swap:s.id}}><Row icon={CalendarClock}>On-call swap — Accept, Decline or Snooze</Row></Link></Button>)}
    {data?.approval.map(s=><Button key={s.id} asChild variant="outline" className={item}><Link to="/standby" search={{swap:s.id}}><Row icon={CalendarClock}>On-call swap — review approval</Row></Link></Button>)}
    {data?.leave.map(r=><Button key={r.id} asChild variant="outline" className={item}><Link to="/admin/leave" search={{request:r.id}}><Row icon={CalendarDays}>Leave consultation — respond</Row></Link></Button>)}
    {data?.responses.map(r=><Button key={r.id} asChild variant="outline" className={item}><Link to="/admin/leave" search={{request:r.id}}><Row icon={CalendarDays}>Supervisor replied — review leave</Row></Link></Button>)}
  </>}</PopoverContent></Popover>;
}
