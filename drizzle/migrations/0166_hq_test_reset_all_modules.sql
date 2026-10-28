CREATE OR REPLACE FUNCTION public.platform_reset_test_data(_company uuid,_confirmation text,_modules text[],_preview boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE co public.companies; result jsonb='{}'::jsonb; n bigint; actor uuid=auth.uid();
 allowed text[]=ARRAY['qs_pricing','skills_dispatch','crm','quotes','surveys','job_sheets','time_tracking','chat','expenses','leave','passport_photos','equipment_reports'];
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 SELECT * INTO co FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND OR _confirmation IS DISTINCT FROM co.name THEN RAISE EXCEPTION 'Enter the exact company name'; END IF;
 PERFORM 1 FROM public.platform_company_controls WHERE company_id=_company AND is_test FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only designated test companies can be cleared'; END IF;
 IF _modules IS NULL OR cardinality(_modules)=0 OR NOT (_modules <@ allowed) OR _preview IS NULL THEN RAISE EXCEPTION 'Choose supported reset modules'; END IF;
 IF NOT _preview THEN
  -- Owner verified above; run the deletes as system so tenant capability guards do not block HQ cleanup.
  PERFORM set_config('request.jwt.claims','',true); PERFORM set_config('request.jwt.claim.sub','',true);
 END IF;
 IF 'qs_pricing'=ANY(_modules) THEN
  IF _preview THEN SELECT count(*) INTO n FROM public.proposals p WHERE p.company_id=_company AND p.status='draft' AND NOT EXISTS(SELECT 1 FROM public.qs_surveys q WHERE q.proposal_id=p.id);
  ELSE DELETE FROM public.proposals p WHERE p.company_id=_company AND p.status='draft' AND NOT EXISTS(SELECT 1 FROM public.qs_surveys q WHERE q.proposal_id=p.id); GET DIAGNOSTICS n=ROW_COUNT; END IF;
  result=result||jsonb_build_object('qs_pricing',n);
 END IF;
 IF 'skills_dispatch'=ANY(_modules) THEN
  IF _preview THEN SELECT count(*) INTO n FROM public.company_skills s WHERE s.company_id=_company AND NOT EXISTS(SELECT 1 FROM public.member_skills m WHERE m.skill_id=s.id) AND NOT EXISTS(SELECT 1 FROM public.job_skills j WHERE j.skill_id=s.id);
  ELSE DELETE FROM public.company_skills s WHERE s.company_id=_company AND NOT EXISTS(SELECT 1 FROM public.member_skills m WHERE m.skill_id=s.id) AND NOT EXISTS(SELECT 1 FROM public.job_skills j WHERE j.skill_id=s.id); GET DIAGNOSTICS n=ROW_COUNT; END IF;
  result=result||jsonb_build_object('skills_dispatch',n);
 END IF;
 IF 'crm'=ANY(_modules) THEN
  IF _preview THEN SELECT count(*) INTO n FROM public.crm_opportunities WHERE company_id=_company;
  ELSE DELETE FROM public.crm_opportunities WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; END IF;
  result=result||jsonb_build_object('crm',n);
 END IF;
 IF 'quotes'=ANY(_modules) THEN
  IF _preview THEN SELECT (SELECT count(*) FROM public.customer_quotes WHERE company_id=_company)+(SELECT count(*) FROM public.proposals WHERE company_id=_company)+(SELECT count(*) FROM public.lift_estimates WHERE company_id=_company)+(SELECT count(*) FROM public.lift_costing_sheets WHERE company_id=_company) INTO n;
  ELSE
   UPDATE public.job_sheets SET customer_quote_id=NULL WHERE company_id=_company AND customer_quote_id IS NOT NULL;
   UPDATE public.jobs SET customer_quote_id=NULL WHERE company_id=_company AND customer_quote_id IS NOT NULL;
   UPDATE public.customer_quotes SET parent_id=NULL WHERE company_id=_company AND parent_id IS NOT NULL;
   DELETE FROM public.customer_quotes WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; result=result||jsonb_build_object('quotes',n);
   DELETE FROM public.lift_costing_sheets WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; n=n+(result->>'quotes')::bigint;
   result=result||jsonb_build_object('quotes',n);
   DELETE FROM public.lift_estimates WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; n=n+(result->>'quotes')::bigint; result=result||jsonb_build_object('quotes',n);
   DELETE FROM public.proposals WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; n=n+(result->>'quotes')::bigint;
  END IF;
  result=result||jsonb_build_object('quotes',n);
 END IF;
 IF 'surveys'=ANY(_modules) THEN
  IF _preview THEN SELECT (SELECT count(*) FROM public.site_surveys WHERE company_id=_company)+(SELECT count(*) FROM public.lift_surveys WHERE company_id=_company)+(SELECT count(*) FROM public.qs_surveys WHERE company_id=_company) INTO n;
  ELSE DELETE FROM public.site_surveys WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; result=result||jsonb_build_object('surveys',n);
   DELETE FROM public.lift_surveys WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; n=n+(result->>'surveys')::bigint; result=result||jsonb_build_object('surveys',n);
   DELETE FROM public.qs_surveys WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; n=n+(result->>'surveys')::bigint; END IF;
  result=result||jsonb_build_object('surveys',n);
 END IF;
 IF 'job_sheets'=ANY(_modules) THEN
  IF _preview THEN SELECT (SELECT count(*) FROM public.job_sheets WHERE company_id=_company)+(SELECT count(*) FROM public.jobs WHERE company_id=_company) INTO n;
  ELSE
   UPDATE public.customer_quotes SET source_sheet_id=NULL, job_id=NULL WHERE company_id=_company AND (source_sheet_id IS NOT NULL OR job_id IS NOT NULL);
   DELETE FROM public.client_reports WHERE company_id=_company;
   DELETE FROM public.job_sheets WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; result=result||jsonb_build_object('job_sheets',n);
   DELETE FROM public.jobs WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; n=n+(result->>'job_sheets')::bigint;
  END IF;
  result=result||jsonb_build_object('job_sheets',n);
 END IF;
 IF 'time_tracking'=ANY(_modules) THEN
  IF _preview THEN SELECT (SELECT count(*) FROM public.shifts WHERE company_id=_company)+(SELECT count(*) FROM public.daily_work_reports WHERE company_id=_company)+(SELECT count(*) FROM public.overtime_logs WHERE company_id=_company) INTO n;
  ELSE
   UPDATE public.daily_work_reports SET superseded_by=NULL WHERE company_id=_company AND superseded_by IS NOT NULL;
   DELETE FROM public.daily_work_reports WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; result=result||jsonb_build_object('time_tracking',n);
   DELETE FROM public.overtime_logs WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; n=n+(result->>'time_tracking')::bigint; result=result||jsonb_build_object('time_tracking',n);
   DELETE FROM public.technician_locations WHERE company_id=_company;
   DELETE FROM public.shifts WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; n=n+(result->>'time_tracking')::bigint;
  END IF;
  result=result||jsonb_build_object('time_tracking',n);
 END IF;
 IF 'chat'=ANY(_modules) THEN
  IF _preview THEN SELECT count(*) INTO n FROM public.internal_messages WHERE company_id=_company;
  ELSE DELETE FROM public.internal_messages WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; END IF;
  result=result||jsonb_build_object('chat',n);
 END IF;
 IF 'expenses'=ANY(_modules) THEN
  IF _preview THEN SELECT count(*) INTO n FROM public.expense_receipts WHERE company_id=_company;
  ELSE UPDATE public.jobsheet_receipts SET expense_id=NULL WHERE expense_id IN (SELECT id FROM public.expense_receipts WHERE company_id=_company);
   DELETE FROM public.expense_receipts WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; END IF;
  result=result||jsonb_build_object('expenses',n);
 END IF;
 IF 'leave'=ANY(_modules) THEN
  IF _preview THEN SELECT count(*) INTO n FROM public.leave_requests WHERE company_id=_company;
  ELSE DELETE FROM public.leave_requests WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; END IF;
  result=result||jsonb_build_object('leave',n);
 END IF;
 IF 'passport_photos'=ANY(_modules) THEN
  IF _preview THEN SELECT count(*) INTO n FROM public.passport_submissions WHERE company_id=_company;
  ELSE DELETE FROM public.passport_submissions WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; END IF;
  result=result||jsonb_build_object('passport_photos',n);
 END IF;
 IF 'equipment_reports'=ANY(_modules) THEN
  IF _preview THEN SELECT count(*) INTO n FROM public.equipment_problem_reports WHERE company_id=_company;
  ELSE DELETE FROM public.equipment_problem_reports WHERE company_id=_company; GET DIAGNOSTICS n=ROW_COUNT; END IF;
  result=result||jsonb_build_object('equipment_reports',n);
 END IF;
 IF NOT _preview THEN INSERT INTO public.platform_audit(actor_id,entity,entity_id,action,after_value) VALUES(actor,'test_company_reset',_company,'RESET',jsonb_build_object('modules',_modules,'removed',result)); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.platform_reset_test_data(uuid,text,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_reset_test_data(uuid,text,text[],boolean) TO authenticated,service_role;