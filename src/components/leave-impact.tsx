import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfile, useCompanyUsers, ROLE_LABEL } from '@/lib/profile';
import { canDecideLeave, canRequestLeaveConsultation, type AppRole } from '@/lib/field-rules';
import { useLeaveBlackouts } from '@/components/leave-blackouts';
import { matchingBlackouts } from '@/lib/attention-rules';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Tables } from '@/integrations/supabase/types';
export function LeaveImpact({ request:r }: {request:Tables<'leave_requests'> & {users:{full_name:string;role:string}|null}}) {
  const {data:me}=useProfile();const {data:users=[]}=useCompanyUsers();const qc=useQueryClient();const blackouts=useLeaveBlackouts();
  const [note,setNote]=useState(r.work_handling_note??'');const [supervisor,setSupervisor]=useState(r.consulted_supervisor_id??'');const [response,setResponse]=useState(r.supervisor_response??'');const [busy,setBusy]=useState(false);
  const q=useQuery({queryKey:['leave-impact',r.id,r.start_date,r.end_date],queryFn:async()=>{
    const jobs=await supabase.from('jobs').select('id,job_number,scheduled_date,priority,secondary_technician_id,clients(name),sites(name)').or(`assigned_technician_id.eq.${r.user_id},secondary_technician_id.eq.${r.user_id}`).gte('scheduled_date',r.start_date).lte('scheduled_date',r.end_date);if(jobs.error)throw jobs.error;
    const days:string[]=[];for(let d=new Date(r.start_date+'T12:00Z');d<=new Date(r.end_date+'T12:00Z');d.setUTCDate(d.getUTCDate()+1))days.push(d.toISOString().slice(0,10));
    const on=await Promise.all(days.map(async date=>{const v=await supabase.rpc('is_on_standby',{_user:r.user_id,_date:date});if(v.error)throw v.error;return v.data?date:null;}));return {jobs:jobs.data,standby:on.filter(Boolean)};
  }});
  const blocks=matchingBlackouts(blackouts.data??[],r.users?.role??'technician',r.leave_type,r.start_date,r.end_date);
  const office=me?.role==='admin'||me?.role==='superuser';const allowed=me&&canDecideLeave(me.role as AppRole,r.users?.role as AppRole,r.user_id===me.id)&&(!blocks.length||office);
  const mutate=async(patch:Partial<Tables<'leave_requests'>>)=>{setBusy(true);const x=await supabase.from('leave_requests').update(patch).eq('id',r.id).select('id');setBusy(false);if(x.error||!x.data?.length){toast.error(x.error?.message??'Action not permitted');return;}await qc.invalidateQueries({queryKey:['leave']});toast.success('Leave review saved');};
  const conflict=(q.data?.jobs.length??0)+(q.data?.standby.length??0)>0;const handled=!!note.trim()||!!r.supervisor_response?.trim();
  return <div className="space-y-3 border-t pt-3"><h3 className="text-sm font-medium">Availability impact</h3>{q.isPending?<p className="text-xs">Checking scheduled work…</p>:q.error?<p role="alert" className="text-xs text-destructive">Unable to check assignments. Approval is unavailable.</p>:<><p className="text-xs">{q.data?.jobs.length??0} assigned jobs · {q.data?.standby.length??0} on-call days</p><ul className="space-y-1 text-xs">{q.data?.jobs.map(j=><li key={j.id}><Link className="text-primary underline" to="/admin/jobs">#{j.job_number} · {j.scheduled_date} · {j.clients?.name} {j.sites?.name} · {j.priority}{j.secondary_technician_id?' · paired job':''}</Link></li>)}</ul>{!!q.data?.standby.length&&<p className="text-xs">On-call: {q.data.standby.join(', ')}</p>}</>}{blocks.map(b=><p key={b.reason} className="text-xs text-warning">Annual leave restricted: {b.reason}</p>)}{r.exception_reason&&<p className="text-xs">Exception request: {r.exception_reason}</p>}
    {allowed&&<><Label htmlFor={`handling-${r.id}`}>Work / on-call handling{conflict&&!r.supervisor_response?.trim()?' (required)':' (optional)'}</Label><Textarea id={`handling-${r.id}`} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Reassigned jobs, cover agreed, or office will handle separately"/></>}
    {me && canRequestLeaveConsultation(me.role)&&<div className="space-y-2"><Label htmlFor={`consult-${r.id}`}>Consult field supervisor or Company Superuser</Label><select id={`consult-${r.id}`} className="h-10 w-full rounded-md border bg-background px-2" value={supervisor} onChange={e=>setSupervisor(e.target.value)}><option value="">Choose person</option>{users.filter(u=>['supervisor','superuser'].includes(u.role)&&u.registration_status==='active'&&u.id!==r.user_id&&u.id!==me?.id).map(u=><option key={u.id} value={u.id}>{u.full_name} · {u.role==='superuser'?'Company Superuser':u.role==='admin'?'Office Admin':'Supervisor'}</option>)}</select><Button variant="outline" size="sm" disabled={!supervisor||busy} onClick={()=>mutate({consulted_supervisor_id:supervisor})}>Request operational input</Button></div>}
    {r.consulted_supervisor_id&&<p className="text-xs">{ROLE_LABEL[users.find(u=>u.id===r.consulted_supervisor_id)?.role ?? 'supervisor']}: {users.find(u=>u.id===r.consulted_supervisor_id)?.full_name??'Requested'} · {r.supervisor_response??'Awaiting input'}</p>}
    {me?.id===r.consulted_supervisor_id&&<div className="space-y-2"><Label htmlFor={`response-${r.id}`}>Operational response</Label><Textarea id={`response-${r.id}`} maxLength={2000} value={response} onChange={e=>setResponse(e.target.value)} placeholder="No operational issue / Reassign jobs first / Your notes"/><Button size="sm" variant="outline" disabled={busy||!response.trim()} onClick={()=>mutate({supervisor_response:response.trim()})}>Send input</Button></div>}
    {r.status==='pending'&&(allowed?<div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy||q.isPending||!!q.error||(conflict&&!handled)} onClick={()=>mutate({status:'approved',work_handling_note:note.trim()||(r.supervisor_response?.trim()?`Consulted reply: ${r.supervisor_response.trim()}`:null)})}>Approve{blocks.length?' exception':''}</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>mutate({status:'rejected'})}>Reject</Button></div>:<p className="text-xs text-muted-foreground">Awaiting Office Admin decision.</p>)}
  </div>;
}