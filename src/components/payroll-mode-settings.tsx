import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/lib/profile';
import { useCompanyRules } from '@/lib/company';
import { usePlanFeatures } from '@/lib/plan-features';
import { payrollMode, type PayrollMode } from '@/lib/payroll-universal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export function PayrollModeSettings() {
 const {data:company}=useCompanyRules(),{data:profile}=useProfile(),qc=useQueryClient(),on=usePlanFeatures();
 const [draft,setDraft]=useState<PayrollMode|null>(null),[busy,setBusy]=useState(false);
 const value=draft??payrollMode(company?.payrollMode);
 const save=async()=>{if(!profile)return;setBusy(true);try{const{error}=await supabase.from('company_settings').upsert({company_id:profile.company_id,payroll_mode:value},{onConflict:'company_id'});if(error)throw error;await Promise.all([qc.invalidateQueries({queryKey:['company-settings']}),qc.invalidateQueries({queryKey:['payroll']})]);setDraft(null);toast.success('Payroll mode saved');}catch(e){toast.error(e instanceof Error?e.message:'Unable to save payroll mode');}finally{setBusy(false);}};
 return <section className="space-y-3 border-b pb-5"><Label>Payroll mode</Label><div className="flex flex-wrap gap-3"><Select value={value} onValueChange={v=>setDraft(payrollMode(v))}><SelectTrigger className="w-full sm:w-80" aria-label="Payroll mode"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="universal_gross">International · Gross earnings only</SelectItem><SelectItem value="statutory_malta" disabled={!on('payroll_statutory_mt')||company?.locale.currency!=='EUR'}>Malta · Statutory payroll (EUR)</SelectItem></SelectContent></Select><Button onClick={save} disabled={busy||!draft}>{busy?'Saving…':'Save payroll mode'}</Button></div>{!on('payroll_statutory_mt')&&<p className="text-sm text-muted-foreground">Malta statutory payroll requires a country compliance pack.</p>}</section>;
}
