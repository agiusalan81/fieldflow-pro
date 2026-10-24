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
  const flags=[can('pending_works')&&on('core'),can('leave_approvals')&&on('core'),can('approvals')&&on('core'),can('inventory')&&on('core'),on('standby'),can('billing')&&on('core'),can('pending_works')&&on('core'),can('contracts')&&on('contracts'),['admin','superuser','supervisor'].includes(profile?.role??'')&&on('receipts')];
  const q = useQuery({ queryKey: ['attention-overview',profile?.id,...flags], enabled:!!profile, refetchInterval: 30000, queryFn: async () => {
    const zero=()=>Promise.resolve({count:0,data:[],error:null});
    const results = await Promise.all([
      flags[0]?supabase.from('job_sheets').select('id', { count: 'exact', head: true }).not('pending_works_future_jobs','is',null).neq('pending_works_future_jobs','').neq('pending_status','done'):zero(),
      flags[1]?supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status','pending'):zero(),
      flags[2]?supabase.from('job_sheets').select('id', { count: 'exact', head: true }).eq('requires_admin_approval',true):zero(),
      flags[3]?supabase.from('inventory_items').select('current_stock,min_stock_level'):zero(),
      flags[4]?supabase.from('standby_swaps').select('id', { count: 'exact', head: true }).eq('status','accepted').eq('manager_approved',false):zero(),
      flags[5]?supabase.from('job_sheets').select('id', { count: 'exact', head: true }).eq('status','completed').eq('billing_status','unreviewed'):zero(),
      flags[6]?supabase.from('equipment_problem_reports').select('id', { count: 'exact', head: true }).eq('status','open'):zero(),
      flags[7]?supabase.from('maintenance_agreements').select('id', { count: 'exact', head: true }).gte('end_date',new Date().toISOString().slice(0,10)).lte('end_date',new Date(Date.now()+30*86400000).toISOString().slice(0,10)):zero(),
      flags[8]?supabase.from('expense_categories').select('id', { count: 'exact' }).eq('status','pending').limit(1):zero(),
    ]); const error = results.find(r => r.error)?.error; if (error) throw error;
    return { pending: results[0]?.count ?? 0, leave: results[1]?.count ?? 0, approvals: results[2]?.count ?? 0, low: (results[3]?.data ?? []).filter((i: {current_stock:number;min_stock_level:number}) => i.current_stock <= i.min_stock_level).length, swaps: results[4]?.count ?? 0, billing: results[5]?.count ?? 0, problems: results[6]?.count ?? 0, renewals: results[7]?.count ?? 0, categories: results[8]?.count ?? 0, firstCategory: (results[8]?.data as {id:string}[]|undefined)?.[0]?.id };
  }});
  const d=q.data; const alerts = [
    { show:can('pending_works') && on('core'), to:'/pending-works', title:'Equipment problem reports', n:d?.problems, icon:AlertTriangle },
    { show:can('pending_works') && on('core'), to:'/pending-works', title:'Pending works requiring attention', n:d?.pending, icon:ClipboardList },
    { show:can('leave_approvals')&&on('core'), to:'/admin/leave', title:'Leave requests awaiting review', n:d?.leave, icon:CalendarDays },
    { show:can('approvals')&&on('core'), to:'/admin/jobs', title:'Job-sheet approvals', n:d?.approvals, icon:AlertTriangle },
    { show:can('inventory')&&on('core'), to:'/admin/inventory', title:'Low-stock items', n:d?.low, icon:Package },
    { show:on('standby'), to:'/standby', title:'On-call swaps awaiting approval', n:d?.swaps, icon:Repeat },
    { show:can('billing')&&on('core'), to:'/admin/jobs', title:'Billing reviews outstanding', n:d?.billing, icon:ClipboardList },
    { show:can('contracts') && on('contracts'), to:'/contracts', title:'Renewals due', n:d?.renewals, icon:CalendarDays },
    { show:!!flags[8], to:'/expenses', search:d?.firstCategory?{category:d.firstCategory}:undefined, title:'Expense categories awaiting approval', n:d?.categories, icon:ClipboardList },
  ].filter(a=>a.show && (a.n ?? 0)>0);
  return <section className="space-y-4"><div className="flex flex-wrap gap-2">{on("tracking") && can("live_status") && <Button asChild variant="outline"><Link to="/live-map"><MapPin className="mr-2 h-4 w-4"/>Live team map</Link></Button>}<Button asChild variant="outline"><Link to="/team">Team availability</Link></Button></div>{q.isPending?<p role="status">Checking alerts…</p>:q.error?<p role="alert" className="text-destructive">Could not load alerts. <Button variant="link" onClick={()=>q.refetch()}>Retry</Button></p>:!alerts.length?<p className="py-8 text-muted-foreground">No outstanding alerts.</p>:<ul className="divide-y border-y">{alerts.map(a=><li key={a.title}><Link search={('search' in a?a.search:undefined) as never} to={a.to as "/pending-works" | "/admin/leave" | "/admin/jobs" | "/admin/inventory" | "/standby" | "/contracts" | "/expenses"} className="flex min-h-16 items-center gap-3 py-3"><a.icon className="h-5 w-5 shrink-0 text-warning"/><span className="min-w-0 flex-1 font-medium">{a.title}</span><span className="rounded-full bg-warning/15 px-3 py-1 text-sm font-semibold tabular-nums">{a.n}</span></Link></li>)}</ul>}</section>;
}