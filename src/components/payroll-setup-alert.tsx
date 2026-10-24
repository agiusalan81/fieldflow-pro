import { missingPayrollMembers } from "@/lib/field-documents";
import {Link} from '@tanstack/react-router';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useProfile} from '@/lib/profile';
import {payrollUiVisible} from '@/lib/payroll';
import {useUserPreview} from '@/lib/impersonation';
import {Button} from '@/components/ui/button';
import { usePlanFeatures } from '@/lib/plan-features';
export function usePayrollSetup(){const{data:profile}=useProfile();const on=usePlanFeatures(!!profile);const{active}=useUserPreview(profile);const year=new Date().getFullYear();return useQuery({queryKey:['payroll-setup',profile?.id,year,on('payroll')],enabled:on('payroll')&&payrollUiVisible(profile)&&!active,refetchInterval:60000,queryFn:async()=>{const[m,s]=await Promise.all([supabase.rpc('registered_members'),supabase.from('employee_payroll_settings').select('user_id').eq('entitlement_year',year)]);if(m.error)throw m.error;if(s.error)throw s.error;return{year,configured:s.data.map(r=>r.user_id),missing:missingPayrollMembers(m.data,s.data)};}});}
export function PayrollSetupAlert(){const q=usePayrollSetup();const on=usePlanFeatures();const first=q.data?.missing[0];if(!on('payroll')||!q.data||!first)return null;return <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-warning bg-warning/10 p-3"><p className="text-sm">{q.data.missing.length} active members need payroll setup for {q.data.year}.</p><Button variant="outline" size="sm" asChild><Link to="/payroll/wages" search={{employee:first.id}}>Set up payroll</Link></Button></div>;}
