CREATE OR REPLACE FUNCTION public.platform_delete_test_company(_subscription uuid,_company uuid,_confirmation text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE co public.companies; s public.platform_subscriptions; actor uuid=auth.uid(); t record; remaining int; pass int=0; jwt text=current_setting('request.jwt.claims',true); sub text=current_setting('request.jwt.claim.sub',true);
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF _subscription IS NOT NULL THEN SELECT * INTO s FROM public.platform_subscriptions WHERE id=_subscription FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Company record not found'; END IF; _company=coalesce(_company,s.company_id); END IF;
 IF _company IS NOT NULL THEN
  SELECT * INTO co FROM public.companies WHERE id=_company FOR UPDATE;
  IF NOT FOUND OR co.name IS DISTINCT FROM _confirmation THEN RAISE EXCEPTION 'Enter the exact company name'; END IF;
  PERFORM 1 FROM public.platform_company_controls WHERE company_id=_company AND is_test; IF NOT FOUND THEN RAISE EXCEPTION 'Only test companies can be deleted'; END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE id=actor AND company_id=_company) THEN RAISE EXCEPTION 'You belong to this company, so it cannot be deleted'; END IF;
  IF EXISTS(SELECT 1 FROM public.payroll_payslips WHERE company_id=_company) THEN RAISE EXCEPTION 'Issued payslips must be retained; this company cannot be deleted'; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_invoices WHERE company_id=_company OR subscription_id IN (SELECT id FROM public.platform_subscriptions WHERE company_id=_company)) THEN RAISE EXCEPTION 'Platform invoices exist for this company; billing history must be retained'; END IF;
 ELSE
  IF s.tenant_name IS DISTINCT FROM _confirmation AND s.external_tenant_id IS DISTINCT FROM _confirmation THEN RAISE EXCEPTION 'Enter the exact company name'; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_invoices WHERE subscription_id=_subscription) THEN RAISE EXCEPTION 'Platform invoices exist for this record; billing history must be retained'; END IF;
 END IF;
 IF _company IS NOT NULL THEN PERFORM public.platform_clean_slate(_company,_confirmation,false); END IF;
 PERFORM set_config('request.jwt.claims','',true); PERFORM set_config('request.jwt.claim.sub','',true);
 DELETE FROM public.platform_conversions WHERE subscription_id IN (SELECT id FROM public.platform_subscriptions WHERE id=_subscription OR company_id=_company);
 DELETE FROM public.platform_usage_daily WHERE subscription_id IN (SELECT id FROM public.platform_subscriptions WHERE id=_subscription OR company_id=_company);
 DELETE FROM public.platform_usage_totals WHERE subscription_id IN (SELECT id FROM public.platform_subscriptions WHERE id=_subscription OR company_id=_company);
 DELETE FROM public.platform_engagement_actions WHERE subscription_id IN (SELECT id FROM public.platform_subscriptions WHERE id=_subscription OR company_id=_company);
 DELETE FROM public.platform_feedback WHERE subscription_id IN (SELECT id FROM public.platform_subscriptions WHERE id=_subscription OR company_id=_company);
 DELETE FROM public.platform_subscriptions WHERE id=_subscription OR (company_id IS NOT NULL AND company_id=_company);
 IF _company IS NOT NULL THEN
  LOOP
   pass=pass+1; remaining=0;
   FOR t IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables tb ON tb.table_schema=c.table_schema AND tb.table_name=c.table_name AND tb.table_type='BASE TABLE' WHERE c.table_schema='public' AND c.column_name='company_id' AND c.table_name NOT IN ('platform_audit','platform_invoices') LOOP
    BEGIN EXECUTE format('DELETE FROM public.%I WHERE company_id=$1',t.table_name) USING _company;
    EXCEPTION WHEN foreign_key_violation OR raise_exception THEN remaining=remaining+1; END;
   END LOOP;
   EXIT WHEN remaining=0 OR pass>=6;
  END LOOP;
  DELETE FROM public.companies WHERE id=_company;
 END IF;
 PERFORM set_config('request.jwt.claims',coalesce(jwt,''),true); PERFORM set_config('request.jwt.claim.sub',coalesce(sub,''),true);
 INSERT INTO public.platform_audit(actor_id,action,entity,entity_id,details) SELECT actor,'delete_test_company','company',coalesce(_company,_subscription),jsonb_build_object('name',_confirmation) WHERE EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_audit' AND column_name='entity_id');
END $$;
REVOKE ALL ON FUNCTION public.platform_delete_test_company(uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_delete_test_company(uuid,uuid,text) TO authenticated;