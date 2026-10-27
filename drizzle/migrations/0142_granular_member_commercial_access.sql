ALTER TABLE public.user_roles ADD COLUMN can_estimates boolean;
ALTER TABLE public.user_roles ADD COLUMN can_contracts boolean;
COMMENT ON COLUMN public.user_roles.can_estimates IS 'Per-member Core estimating access; null retains role defaults.';
COMMENT ON COLUMN public.user_roles.can_contracts IS 'Per-member contracts access; null retains office role defaults.';
CREATE OR REPLACE FUNCTION public.member_commercial_can(_area text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.company_id=public.current_company_id() AND public.member_is_active(r.user_id) AND CASE _area WHEN 'estimates' THEN coalesce(r.can_estimates,r.role IN ('superuser','admin','supervisor')) WHEN 'contracts' THEN coalesce(r.can_contracts,r.role IN ('superuser','admin')) ELSE false END)
$$;
REVOKE ALL ON FUNCTION public.member_commercial_can(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.member_commercial_can(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.my_member_capabilities() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('estimates',public.member_commercial_can('estimates'),'contracts',public.member_commercial_can('contracts')) $$;
REVOKE ALL ON FUNCTION public.my_member_capabilities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_member_capabilities() TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_member_commercial_capabilities() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF (TG_OP='INSERT' AND (NEW.can_estimates IS NOT NULL OR NEW.can_contracts IS NOT NULL)) OR (TG_OP='UPDATE' AND (NEW.can_estimates IS DISTINCT FROM OLD.can_estimates OR NEW.can_contracts IS DISTINCT FROM OLD.can_contracts)) THEN
 IF NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT public.member_is_active(auth.uid()) OR NOT(public.my_role()='superuser' OR (public.my_role()='admin' AND NEW.role<>'superuser')) THEN RAISE EXCEPTION 'Company office admin access required'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_member_commercial_capabilities BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_member_commercial_capabilities();
CREATE OR REPLACE FUNCTION public.set_member_workspaces(_user uuid,_estimates boolean,_contracts boolean,_field boolean,_crm text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target public.user_roles; BEGIN
 SELECT * INTO target FROM public.user_roles WHERE user_id=_user AND company_id=public.current_company_id() FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) OR NOT(public.my_role()='superuser' OR (public.my_role()='admin' AND target.role<>'superuser')) THEN RAISE EXCEPTION 'Company office admin access required'; END IF;
 PERFORM public.set_member_capabilities(_user,_field,target.can_commercial_access);
 PERFORM public.set_member_crm_access(_user,_crm);
 UPDATE public.user_roles SET can_estimates=_estimates,can_contracts=_contracts WHERE user_id=_user AND company_id=public.current_company_id();
 END $$;
REVOKE ALL ON FUNCTION public.set_member_workspaces(uuid,boolean,boolean,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_member_workspaces(uuid,boolean,boolean,boolean,text) TO authenticated;
ALTER POLICY "Office reads customer quotes" ON public.customer_quotes USING(company_id=public.current_company_id() AND public.member_commercial_can('estimates'));
ALTER POLICY "Office reads quote history" ON public.customer_quote_events USING(company_id=public.current_company_id() AND public.member_commercial_can('estimates'));
ALTER POLICY "Office reads delivery" ON public.customer_quote_deliveries USING(company_id=public.current_company_id() AND public.member_commercial_can('estimates'));
ALTER POLICY "Company quote photo read" ON public.customer_quote_photos USING(company_id=public.current_company_id() AND public.member_commercial_can('estimates'));
ALTER POLICY "Company quote photo insert" ON public.customer_quote_photos WITH CHECK(company_id=public.current_company_id() AND created_by=auth.uid() AND storage_path=company_id::text||'/'||id::text||'.jpg' AND public.member_commercial_can('estimates') AND public.company_module_access(company_id,'core'));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['contract_types','maintenance_agreements'] LOOP
 EXECUTE format('CREATE POLICY member_contract_access ON public.%I FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.member_commercial_can(''contracts'')) WITH CHECK(company_id=public.current_company_id() AND public.member_commercial_can(''contracts''))',t);
 EXECUTE format('CREATE POLICY member_contract_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.member_commercial_can(''contracts'')) WITH CHECK(public.member_commercial_can(''contracts''))',t);
 END LOOP; END $$;
CREATE POLICY commercial_terms_read ON public.document_masters FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND kind='terms' AND state='active' AND public.member_commercial_can('estimates'));
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.delete_customer_quote(uuid)'::regprocedure) INTO d;
 d:=replace(d,'NOT public.is_company_manager()','NOT public.member_commercial_can(''estimates'')'); EXECUTE d;
 END $$;