import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile, isManager } from '@/lib/profile';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export function ActionNotifications() {
  const { data:p }=useProfile();
  const {data}=useQuery({queryKey:['action-notifications',p?.id],enabled:!!p,refetchInterval:15000,queryFn:async()=>{
    if(!p)return {incoming:0,approval:0,leave:0};
    const [incoming,approval,leave]=await Promise.all([
      supabase.from('standby_swaps').select('id',{count:'exact',head:true}).eq('target_id',p.id).eq('status','pending'),
      isManager(p)?supabase.from('standby_swaps').select('id',{count:'exact',head:true}).eq('status','accepted').eq('manager_approved',false):Promise.resolve({count:0,error:null}),
      supabase.from('leave_requests').select('id',{count:'exact',head:true}).eq('consulted_supervisor_id',p.id).eq('status','pending').is('supervisor_response',null)
    ]);if(incoming.error||approval.error||leave.error)throw incoming.error||approval.error||leave.error;return {incoming:incoming.count??0,approval:approval.count??0,leave:leave.count??0};
  }});
  const count=(data?.incoming??0)+(data?.approval??0)+(data?.leave??0);
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={`Pending actions: ${count}`}><Bell className="h-5 w-5"/>{count>0&&<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{count}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="w-72 space-y-3"><h2 className="font-medium">Pending actions</h2>{!count?<p className="text-sm text-muted-foreground">Nothing awaiting your attention.</p>:<>{!!data?.incoming&&<Button asChild variant="outline" className="w-full"><Link to="/standby">{data.incoming} on-call swap request(s)</Link></Button>}{!!data?.approval&&<Button asChild variant="outline" className="w-full"><Link to="/standby">{data.approval} swap approval(s)</Link></Button>}{!!data?.leave&&<Button asChild variant="outline" className="w-full"><Link to="/admin/leave">{data.leave} leave consultation(s)</Link></Button>}</>}</PopoverContent></Popover>;
}