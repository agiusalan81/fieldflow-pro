import { useOpenJobs } from "@/lib/open-jobs";
import { useCrmAccess } from '@/lib/crm-access';
import { crmAllows } from '@/lib/crm';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, MessageSquare, CalendarClock, CalendarDays, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile, isManager, isOffice } from '@/lib/profile';
import { usePlanFeatures } from '@/lib/plan-features';
import { useCan } from '@/lib/permissions';
import { useUnreadChatTotal, useChatReads, unreadByThread, type ChatMsg } from '@/lib/chat-unread';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavLock } from '@/lib/plan-features';
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
    const m = await supabase.from('internal_messages').select('sender_id,receiver_id,job_sheet_id,channel_id,created_at').neq('sender_id', uid).gte('created_at', since);
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
    const channelIds = [...new Set(msgs.map(m=>m.channel_id).filter(Boolean))] as string[];
    if (channelIds.length) { const r=await supabase.from("message_channels").select("id,name").in("id",channelIds); for(const c of r.data??[])names[`channel:${c.id}`]=c.name; }
    return { msgs, names };
  } });
  if (!uid || !reads.data || !q.data) return [];
  const counts = unreadByThread(q.data.msgs, reads.data, uid);
  return Object.entries(counts).map(([key, n]) => ({ key, n, name: q.data.names[key] ?? 'Conversation' }));
}

const Row = ({ icon: Icon, children }: { icon: typeof Bell; children: React.ReactNode }) => <span className="flex w-full items-center gap-2 text-left"><Icon className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 break-words">{children}</span></span>;

export function useActionQueues() {
  const { data:p }=useProfile();
  const plan=usePlanFeatures(!!p),lock=useNavLock(!!p),can=useCan(p);
  const on=(key:string)=>plan(key)&&!lock(key).locked;
  const core=on('core'),standby=on('standby');
  const threads=useUnreadThreads(core?p?.id:undefined);
  const manager=!!p&&isManager(p);
  const catsOn=!!p&&on('receipts')&&['admin','superuser','supervisor'].includes(p.role),leaveOn=core&&can('leave_approvals'),problemsOn=core&&manager&&can('pending_works');
  const surveysOn=!!p&&on('site_surveys')&&manager;
  const passportOn=!!p&&manager&&on('lift_pack');
  const passports=useQuery({queryKey:['action-notifications','passports',p?.id,passportOn],enabled:passportOn,refetchInterval:15000,queryFn:async()=>{const r=await supabase.from('passport_submissions').select('id,asset_id,title').eq('status','pending').order('created_at').limit(50);if(r.error)throw r.error;return r.data;}}).data??[];
  const surveys=useQuery({queryKey:['action-notifications','surveys',p?.id,surveysOn],enabled:surveysOn,refetchInterval:15000,queryFn:async()=>{if(!p)return [];const r=await supabase.from('site_surveys').select('id,location_ref,reviewer_id').in('status',['submitted','under_review']).or(`reviewer_id.eq.${p.id},reviewer_id.is.null`).order('submitted_at',{ascending:true}).limit(20);if(r.error)throw r.error;return r.data;}}).data??[];
  const crmLevel=useCrmAccess(!!p).data;const crmOn=crmAllows(crmLevel,'viewer')&&on('crm_pipeline');
  const crm=useQuery({queryKey:['action-notifications','crm',p?.id,crmOn],enabled:crmOn,refetchInterval:30000,queryFn:async()=>{const end=new Date();end.setHours(23,59,59,999);const r=await supabase.from('crm_followups').select('id,opportunity_id,action_label,due_at').is('done_at',null).lte('due_at',end.toISOString()).or(`assignee_id.eq.${p?.id},assignee_id.is.null`).order('due_at').limit(20);if(r.error)throw r.error;return r.data;}}).data??[];
  const quotesOn=core&&manager;
  const decided=useQuery({queryKey:['action-notifications','quote-decisions',p?.id,quotesOn],enabled:quotesOn,refetchInterval:15000,queryFn:async()=>{const r=await supabase.from('customer_quotes').select('id,reference,status').or('status.eq.awaiting_confirmation,and(status.in.(accepted,declined),office_seen_at.is.null)').order('decided_at',{ascending:false}).limit(20);if(r.error)throw r.error;return r.data;}}).data??[];
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
  const openJobs=useOpenJobs().alerting;
  const chat=threads.reduce((a,t)=>a+t.n,0);
  const problems=data?.problems??[];
  const count=openJobs.length+passports.length+crm.length+decided.length+surveys.length+chat+(data?.incoming.length??0)+(data?.approval.length??0)+(data?.leave.length??0)+(data?.responses.length??0)+problems.length+(data?.categories.length??0);
  return { openJobs, passports, threads, crm, decided, surveys, problems, data, count, chat };
}

export function QueueBadge({ path }: { path: string }) {
  const q = useActionQueues();
  const counts: Record<string, number> = {
    '/crm': q.crm.length,
    '/estimates': q.decided.length,
    '/admin/jobs': q.problems.length,
    '/admin/leave': (q.data?.leave.length ?? 0) + (q.data?.responses.length ?? 0),
    '/admin/approvals': (q.data?.categories.length ?? 0)+q.passports.length,
  };
  const count = counts[path] ?? 0;
  const cls = 'shrink-0 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground';
  if (!count) return null;
  if (path === '/crm' && q.crm[0]) return <Link className={cls} aria-label={`${count} follow-ups — open next`} to="/crm" search={{ lead: q.crm[0].opportunity_id }}>{count}</Link>;
  if (path === '/estimates' && q.decided[0]) return <Link className={cls} aria-label={`${count} decisions — open next`} to="/estimates" search={{ quote: q.decided[0].id }}>{count}</Link>;
  if (path === '/admin/jobs' && q.problems[0]) return <Link className={cls} aria-label={`${count} equipment reports — open next`} to="/admin/jobs" search={{ new: true, assetId: q.problems[0].asset_id, problemId: q.problems[0].id }}>{count}</Link>;
  const leave = q.data?.leave[0] ?? q.data?.responses[0];
  if (path === '/admin/leave' && leave) return <Link className={cls} aria-label={`${count} leave actions — open next`} to="/admin/leave" search={{ request: leave.id }}>{count}</Link>;
  if (path === '/admin/approvals' && q.data?.categories[0]) return <Link className={cls} aria-label={`${count} expense categories — open next`} to="/admin/approvals" search={{ category: 'expenses', item: q.data.categories[0].id }}>{count}</Link>;
  if(path==='/admin/approvals'&&q.passports[0])return <Link className={cls} to="/equipment/$assetId" params={{assetId:q.passports[0].asset_id}} search={{view:'passport',submission:q.passports[0].id}}>{count}</Link>;
  return null;
}

export function ActionNotifications() {
  const { openJobs, passports, threads, crm, decided, surveys, problems, data, count } = useActionQueues();
  const [open, setOpen] = useState(false);
  const approvalCount = passports.length+(data?.incoming.length ?? 0) + (data?.approval.length ?? 0) + (data?.leave.length ?? 0) + (data?.responses.length ?? 0) + (data?.categories.length ?? 0);
  const commercialCount = crm.length + decided.length;
  const fieldCount = openJobs.length + problems.length + surveys.length + threads.reduce((n, t) => n + t.n, 0);
  const item="h-auto w-full justify-start whitespace-normal py-3 [&_span]:whitespace-normal [&_span]:break-words [&_span]:text-wrap";
  const empty = <p className="py-6 text-sm text-muted-foreground">Nothing awaiting your attention here.</p>;
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={`Pending actions: ${count}`}><Bell className="h-5 w-5" />{count > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{count}</span>}</Button></SheetTrigger>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader><SheetTitle>Attention · {count}</SheetTitle><SheetDescription>Pending actions and unread conversations</SheetDescription></SheetHeader>
      <Tabs defaultValue={fieldCount && !approvalCount && !commercialCount ? 'field' : approvalCount ? 'approvals' : 'commercial'} className="min-w-0 px-4 pb-6" onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        <TabsList className="grid h-auto w-full grid-cols-3"><TabsTrigger value="approvals" className="min-w-0 whitespace-normal text-xs">Approvals · {approvalCount}</TabsTrigger><TabsTrigger value="commercial" className="min-w-0 whitespace-normal text-xs">Commercial · {commercialCount}</TabsTrigger><TabsTrigger value="field" className="min-w-0 whitespace-normal text-xs">Field & chat · {fieldCount}</TabsTrigger></TabsList>
        <TabsContent value="approvals" className="space-y-2 pt-3">{!approvalCount && empty}
          {passports.map(s=><Button key={s.id} asChild variant="outline" className={item}><Link to="/equipment/$assetId" params={{assetId:s.asset_id}} search={{view:'passport',submission:s.id}}><Row icon={AlertTriangle}>Technical passport handover: {s.title}</Row></Link></Button>)}
          {data?.categories.map(c=><Button key={c.id} asChild variant="outline" className={item}><Link to="/admin/approvals" search={{category:"expenses",item:c.id}}><Row icon={AlertTriangle}>Expense category to approve: {c.name}</Row></Link></Button>)}
          {data?.incoming.map(s=><Button key={s.id} asChild variant="outline" className={item}><Link to="/standby" search={{swap:s.id}}><Row icon={CalendarClock}>On-call swap — Accept, Decline or Snooze</Row></Link></Button>)}
          {data?.approval.map(s=><Button key={s.id} asChild variant="outline" className={item}><Link to="/standby" search={{swap:s.id}}><Row icon={CalendarClock}>On-call swap — review approval</Row></Link></Button>)}
          {data?.leave.map(r=><Button key={r.id} asChild variant="outline" className={item}><Link to="/admin/leave" search={{request:r.id}}><Row icon={CalendarDays}>Leave consultation — respond</Row></Link></Button>)}
          {data?.responses.map(r=><Button key={r.id} asChild variant="outline" className={item}><Link to="/admin/leave" search={{request:r.id}}><Row icon={CalendarDays}>Supervisor replied — review leave</Row></Link></Button>)}
        </TabsContent>
        <TabsContent value="commercial" className="space-y-2 pt-3">{!commercialCount && empty}
          {crm.map(f=><Button key={f.id} asChild variant="outline" className={item}><Link to="/crm" search={{lead:f.opportunity_id}}><Row icon={CalendarClock}>{new Date(f.due_at)<new Date()?'Overdue':'Due today'}: {f.action_label}</Row></Link></Button>)}
          {decided.map(v=><Button key={v.id} asChild variant="outline" className={item}><Link to="/estimates" search={{quote:v.id}}><Row icon={AlertTriangle}>{v.status === 'awaiting_confirmation' ? `Awaiting client confirmation · ${v.reference}` : `Client ${v.status} quote ${v.reference}`}</Row></Link></Button>)}
        </TabsContent>
        <TabsContent value="field" className="space-y-2 pt-3">{!fieldCount && empty}
          {openJobs.map(j=><Button key={j.id} asChild variant="outline" className={item}><Link to="/available-jobs" search={{job:j.id}}><Row icon={AlertTriangle}>Up for grabs · #{j.job_number} · {j.site_name ?? j.client_name}</Row></Link></Button>)}
          {problems.map(r=><Button key={r.id} asChild variant="outline" className={item}><Link to="/admin/jobs" search={{new:true,assetId:r.asset_id,problemId:r.id}}><Row icon={AlertTriangle}>Equipment problem: {r.problem}</Row></Link></Button>)}
          {surveys.map(v=><Button key={v.id} asChild variant="outline" className={item}><Link to="/surveys" search={{survey:v.id}}><Row icon={AlertTriangle}>Site survey to review{v.location_ref?`: ${v.location_ref}`:''}{v.reviewer_id?' (assigned to you)':''}</Row></Link></Button>)}
          {threads.map(t=><Button key={t.key} asChild variant="outline" className={item}><Link to="/messages" search={{thread:t.key}}><Row icon={MessageSquare}>{t.name} · {t.n} new</Row></Link></Button>)}
        </TabsContent>
      </Tabs>
    </SheetContent>
  </Sheet>;
}
