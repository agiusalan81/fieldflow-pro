import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, ClipboardList, MapPin, Package, Repeat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/lib/profile';
import { useCan } from '@/lib/permissions';
import { usePlanFeatures } from '@/lib/plan-features';
import { Button } from '@/components/ui/button';
export function AttentionOverview() {
  const { data: profile } = useProfile(); const can = useCan(profile); const on = usePlanFeatures();
  const q = useQuery({ queryKey: ['attention-overview'], refetchInterval: 30000, queryFn: async () => {
    const results = await Promise.all([
      supabase.from('job_sheets').select('id', { count: 'exact', head: true }).not('pending_works_future_jobs','is',null).neq('pending_works_future_jobs','').neq('pending_status','done'),
      supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status','pending'),
      supabase.from('job_sheets').select('id', { count: 'exact', head: true }).eq('requires_admin_approval',true),
      supabase.from('inventory_items').select('current_stock,min_stock_level'),
      supabase.from('standby_swaps').select('id', { count: 'exact', head: true }).eq('status','accepted').eq('manager_approved',false),
      supabase.from('job_sheets').select('id', { count: 'exact', head: true }).eq('status','completed').eq('billing_status','unreviewed'),
      supabase.from('maintenance_agreements').select('id', { count: 'exact', head: true }).lte('end_date',new Date(Date.now()+30*86400000).toISOString().slice(0,10)),
    ]); const error = results.find(r => r.error)?.error; if (error) throw error;
    return { pending: results[0]?.count ?? 0, leave: results[1]?.count ?? 0, approvals: results[2]?.count ?? 0, low: (results[3]?.data ?? []).filter((i: {current_stock:number;min_stock_level:number}) => i.current_stock <= i.min_stock_level).length, swaps: results[4]?.count ?? 0, billing: results[5]?.count ?? 0, renewals: results[6]?.count ?? 0 };
  }});
  const d=q.data; const alerts = [
    { show:can('pending_works'), to:'/pending-works', title:'Pending works requiring attention', n:d?.pending, icon:ClipboardList },
    { show:can('leave_approvals'), to:'/admin/leave', title:'Leave requests awaiting review', n:d?.leave, icon:CalendarDays },
    { show:can('approvals'), to:'/admin/jobs', title:'Job-sheet approvals', n:d?.approvals, icon:AlertTriangle },
    { show:can('inventory'), to:'/admin/inventory', title:'Low-stock items', n:d?.low, icon:Package },
    { show:on('standby'), to:'/standby', title:'On-call swaps awaiting approval', n:d?.swaps, icon:Repeat },
    { show:can('billing'), to:'/admin/jobs', title:'Billing reviews outstanding', n:d?.billing, icon:ClipboardList },
    { show:can('contracts') && on('contracts'), to:'/contracts', title:'Renewals due', n:d?.renewals, icon:CalendarDays },
  ].filter(a=>a.show && (a.n ?? 0)>0);
  return <section className="space-y-4"><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/live-map"><MapPin className="mr-2 h-4 w-4"/>Live team map</Link></Button><Button asChild variant="outline"><Link to="/team">Team availability</Link></Button></div>{q.isPending?<p role="status">Checking alerts…</p>:q.error?<p role="alert" className="text-destructive">Could not load alerts. <Button variant="link" onClick={()=>q.refetch()}>Retry</Button></p>:!alerts.length?<p className="py-8 text-muted-foreground">No outstanding alerts.</p>:<ul className="divide-y border-y">{alerts.map(a=><li key={a.title}><Link to={a.to} className="flex min-h-16 items-center gap-3 py-3"><a.icon className="h-5 w-5 shrink-0 text-warning"/><span className="min-w-0 flex-1 font-medium">{a.title}</span><span className="rounded-full bg-warning/15 px-3 py-1 text-sm font-semibold tabular-nums">{a.n}</span></Link></li>)}</ul>}</section>;
}