CREATE FUNCTION public.platform_reset_test_data(_company uuid,_confirmation text,_modules text[],_preview boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE co public.companies; result jsonb='{}'::jsonb; n bigint;
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 SELECT * INTO co FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND OR _confirmation IS DISTINCT FROM co.name THEN RAISE EXCEPTION 'Enter the exact company name'; END IF;
 PERFORM 1 FROM public.platform_company_controls WHERE company_id=_company AND is_test FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only designated test companies can be cleared'; END IF;
 IF _modules IS NULL OR cardinality(_modules)=0 OR cardinality(_modules)>2 OR NOT (_modules <@ ARRAY['qs_pricing','skills_dispatch']::text[]) OR _preview IS NULL THEN RAISE EXCEPTION 'Choose supported reset modules'; END IF;
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
 IF NOT _preview THEN INSERT INTO public.platform_audit(actor_id,entity,entity_id,action,after_value) VALUES(auth.uid(),'test_company_reset',_company,'RESET',jsonb_build_object('modules',_modules,'removed',result)); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.platform_reset_test_data(uuid,text,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_reset_test_data(uuid,text,text[],boolean) TO authenticated,service_role;