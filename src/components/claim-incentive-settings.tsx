import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { incentiveCents, incentiveAmount } from '@/lib/claim-incentive';

export function ClaimIncentiveSettings({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({queryKey:['claim-incentive-settings',companyId],queryFn:async()=>{
    const r=await supabase.from('company_settings').select('claim_incentive_enabled,claim_incentive_cents').eq('company_id',companyId).single();
    if(r.error)throw r.error; return r.data;
  }});
  const [enabled,setEnabled]=useState(false),[amount,setAmount]=useState('0.00'),[busy,setBusy]=useState(false);
  useEffect(()=>{if(q.data){setEnabled(q.data.claim_incentive_enabled);setAmount((q.data.claim_incentive_cents/100).toFixed(2));}},[q.data]);
  const save=async()=>{
    const cents=incentiveCents(amount); if(cents===null){toast.error('Enter a non-negative euro amount with up to two decimals');return;}
    setBusy(true);try{
      const r=await supabase.from('company_settings').update({claim_incentive_enabled:enabled,claim_incentive_cents:cents}).eq('company_id',companyId);
      if(r.error)throw r.error;await qc.invalidateQueries({queryKey:['claim-incentive-settings']});toast.success('Claim incentive settings saved');
    }catch{toast.error('Could not save claim incentive settings');}finally{setBusy(false);}
  };
  return <section className="space-y-4 border-t pt-5"><h2 className="font-medium">Up for grabs incentives</h2>
    {q.error?<p role="alert" className="text-destructive">Could not load settings</p>:<>
    <Label className="flex items-center justify-between gap-3">Enable claim incentive<Switch aria-label="Enable claim incentive" checked={enabled} onCheckedChange={setEnabled}/></Label>
    <div className="max-w-xs space-y-2"><Label htmlFor="default-claim-bonus">Default bonus (€)</Label><Input id="default-claim-bonus" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
    <Button disabled={busy||!q.data} onClick={save}>{busy?'Saving…':'Save incentives'}</Button>
    </>}
    <ClaimIncentiveLedger companyId={companyId}/>
  </section>;
}

export function ClaimIncentiveLedger({ companyId }: { companyId: string }) {
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const from=`${month}-01`, next=new Date(`${from}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth()+1);
  const q=useQuery({queryKey:['claim-incentive-ledger',companyId,month],enabled:!!month,queryFn:async()=>{
    const rows: {id:string;user_id:string;amount_cents:number;earned_at:string|null;jobs:{job_number:number}|null}[]=[];
    for(let offset=0;;offset+=500){const r=await supabase.from('job_claim_incentives').select('id,user_id,amount_cents,earned_at,jobs(job_number)').gte('claimed_at',from).lt('claimed_at',next.toISOString()).order('claimed_at',{ascending:false}).range(offset,offset+499);if(r.error)throw r.error;rows.push(...(r.data??[]));if((r.data?.length??0)<500)break;}
    const users=await supabase.from('users').select('id,full_name').in('id',[...new Set(rows.map(r=>r.user_id))]);
    return rows.map(r=>({...r,name:users.data?.find(u=>u.id===r.user_id)?.full_name??'Team member'}));
  }});
  return <div className="space-y-3"><Label htmlFor="incentive-month">Claim ledger month</Label><Input id="incentive-month" className="max-w-xs" type="month" value={month} onChange={e=>setMonth(e.target.value)}/>
    {q.error?<p role="alert" className="text-destructive">Could not load claim ledger</p>:<>
    <p className="text-sm">Earned: {incentiveAmount((q.data??[]).filter(r=>r.earned_at).reduce((n,r)=>n+r.amount_cents,0))} · Pending completion: {incentiveAmount((q.data??[]).filter(r=>!r.earned_at).reduce((n,r)=>n+r.amount_cents,0))}</p>
    <ul className="divide-y">{q.data?.map(r=><li key={r.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>#{r.jobs?.job_number} · {r.name}</span><span>{incentiveAmount(r.amount_cents)} · {r.earned_at?'Earned':'Pending completion'}</span></li>)}</ul>
    </>}
  </div>;
}