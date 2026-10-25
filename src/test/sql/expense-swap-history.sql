BEGIN;
DO $$
DECLARE office uuid; co uuid; a uuid; b uuid; electrical uuid; refrigeration uuid; swap uuid; receipt uuid;
BEGIN
 SELECT user_id,company_id INTO office,co FROM public.user_roles WHERE role='superuser' AND registration_status='active' ORDER BY created_at LIMIT 1;
 SELECT user_id INTO a FROM public.user_roles WHERE company_id=co AND role='technician' AND registration_status='active' ORDER BY created_at LIMIT 1;
 SELECT user_id INTO b FROM public.user_roles WHERE company_id=co AND role='technician' AND registration_status='active' AND user_id<>a ORDER BY created_at LIMIT 1;
 IF office IS NULL OR a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Active office and two technician fixtures required';END IF;
 PERFORM set_config('request.jwt.claim.sub',office::text,true);
 INSERT INTO public.company_skills(company_id,name,category) VALUES(co,'Rollback Electrical '||gen_random_uuid(),'Regression') RETURNING id INTO electrical;
 INSERT INTO public.company_skills(company_id,name,category) VALUES(co,'Rollback Refrigeration '||gen_random_uuid(),'Regression') RETURNING id INTO refrigeration;
 INSERT INTO public.member_skills(company_id,user_id,skill_id) VALUES(co,a,electrical),(co,b,electrical),(co,b,refrigeration);
 PERFORM public.set_member_primary_skill(a,electrical);PERFORM public.set_member_primary_skill(b,refrigeration);
 PERFORM public.save_standby_track('technician',current_date,7,1,ARRAY[a,b]);
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 BEGIN
 INSERT INTO public.standby_swaps(company_id,swap_date,end_date,requester_id,target_id,track) VALUES(co,current_date,current_date,a,b,'technician');
 RAISE EXCEPTION 'Mismatched primary trades allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Mismatched primary trades allowed' THEN RAISE; END IF; IF SQLERRM<>'Choose a colleague with the same primary skill' THEN RAISE;END IF; END;
 PERFORM set_config('request.jwt.claim.sub',office::text,true);PERFORM public.set_member_primary_skill(b,electrical);
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 INSERT INTO public.standby_swaps(company_id,swap_date,end_date,requester_id,target_id,track) VALUES(co,current_date,current_date,a,b,'technician') RETURNING id INTO swap;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 UPDATE public.standby_swaps SET status='accepted' WHERE id=swap;
 IF NOT EXISTS(SELECT 1 FROM public.standby_swaps WHERE id=swap AND manager_approved AND acceptance_applied AND approved_by IS NULL AND responded_at IS NOT NULL) THEN RAISE EXCEPTION 'Recipient acceptance did not apply matching swap';END IF;
 IF NOT b=ANY(public.standby_track_ids(co,current_date,'technician')) THEN RAISE EXCEPTION 'Accepted swap not in rota';END IF;
 INSERT INTO public.expense_receipts(company_id,uploaded_by,file_path,expense_date,amount,currency) VALUES(co,b,co::text||'/expenses/'||gen_random_uuid()::text||'.pdf','2026-10-20',12.45,'EUR') RETURNING id INTO receipt;
 IF NOT EXISTS(SELECT 1 FROM public.expense_receipts WHERE id=receipt AND expense_date='2026-10-20' AND amount=12.45) THEN RAISE EXCEPTION 'Expense details not retained';END IF;
END $$;
ROLLBACK;