-- Rollback-only integration regression: run with the managed database connection.
BEGIN;
SELECT set_config('request.jwt.claim.sub','457c0821-0251-4c77-b768-c0ffd0f17ba9',true);
DO $$
DECLARE c uuid:=public.current_company_id(); u uuid:='5f1f13cf-e99d-491e-8da2-adff46e7a132'; j uuid; i uuid; slip uuid; snapshot jsonb; rejected boolean:=false;
BEGIN
 INSERT INTO public.jobs(company_id,client_id,problem_summary,scheduled_date)
 SELECT c,id,'QA rollback payroll incentive',NULL FROM public.clients WHERE company_id=c LIMIT 1 RETURNING id INTO j;
 IF j IS NULL THEN RAISE EXCEPTION 'Test company needs a client'; END IF;
 INSERT INTO public.job_claim_incentives(company_id,job_id,user_id,amount_cents,earned_at) VALUES(c,j,u,50,'2099-10-15T12:00:00Z') RETURNING id INTO i;
 snapshot:=jsonb_build_object('from','2099-10-01','to','2099-10-31','currency','EUR','adjustments',jsonb_build_object('bonus',0.50),'totals',jsonb_build_object('gross',80.50,'net',80.50),'claimIncentives',jsonb_build_object('ids',jsonb_build_array(i::text),'amountCents',50));
 BEGIN
  INSERT INTO public.payroll_payslips(company_id,user_id,period_start,period_end,snapshot,gross_eur,net_eur,created_by) VALUES(c,u,'2099-10-01','2099-10-31',snapshot-'claimIncentives',80.50,80.50,auth.uid());
 EXCEPTION WHEN OTHERS THEN IF position('Earned incentives changed' in SQLERRM)=0 THEN RAISE; END IF; rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Payroll accepted missing earned incentives'; END IF;
 INSERT INTO public.payroll_payslips(company_id,user_id,period_start,period_end,snapshot,gross_eur,net_eur,created_by) VALUES(c,u,'2099-10-01','2099-10-31',snapshot,80.50,80.50,auth.uid()) RETURNING id INTO slip;
 IF NOT EXISTS(SELECT 1 FROM public.job_claim_incentives WHERE id=i AND payslip_id=slip) THEN RAISE EXCEPTION 'Earned incentive not linked atomically'; END IF;
 rejected:=false;
 BEGIN UPDATE public.payroll_payslips SET gross_eur=81 WHERE id=slip;
 EXCEPTION WHEN OTHERS THEN IF position('Issued payslips cannot be changed' in SQLERRM)=0 THEN RAISE; END IF; rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Issued incentive payslip was mutable'; END IF;
 rejected:=false;
 BEGIN INSERT INTO public.payroll_payslips(company_id,user_id,period_start,period_end,snapshot,gross_eur,net_eur,created_by) VALUES(c,u,'2099-10-01','2099-10-31',snapshot,80.50,80.50,auth.uid());
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Earned incentive paid twice'; END IF;
END $$;
ROLLBACK;