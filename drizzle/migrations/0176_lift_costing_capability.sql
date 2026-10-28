ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS can_lift_costing boolean;
CREATE OR REPLACE FUNCTION public.member_costing_can() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.company_id=public.current_company_id() AND r.registration_status='active'
  AND (r.role='superuser' OR coalesce(r.can_lift_costing, r.role='admin')))
$$;
REVOKE ALL ON FUNCTION public.member_costing_can() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_costing_can() TO authenticated;
CREATE OR REPLACE FUNCTION public.set_member_lift_costing(_user uuid, _enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.user_roles; BEGIN
 SELECT * INTO r FROM public.user_roles WHERE user_id=_user AND company_id=public.current_company_id() FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) OR NOT(public.my_role()='superuser' OR (public.my_role()='admin' AND r.role<>'superuser')) THEN RAISE EXCEPTION 'Company office admin access required'; END IF;
 UPDATE public.user_roles SET can_lift_costing=_enabled WHERE user_id=_user AND company_id=public.current_company_id();
END $$;
REVOKE ALL ON FUNCTION public.set_member_lift_costing(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_lift_costing(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.my_member_capabilities() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('estimates',public.member_commercial_can('estimates'),'contracts',public.member_commercial_can('contracts'),'dispatch',public.member_dispatch_can(),'surveys',public.member_survey_can(),'lift_costing',public.member_costing_can())
$$;
ALTER POLICY "Managers manage company costing" ON public.lift_costing_sheets USING (company_id=public.current_company_id() AND public.is_company_manager() AND public.member_costing_can()) WITH CHECK (company_id=public.current_company_id() AND public.is_company_manager() AND public.member_costing_can());
ALTER POLICY "Managers manage company costing templates" ON public.lift_costing_templates USING (company_id=public.current_company_id() AND public.is_company_manager() AND public.member_costing_can()) WITH CHECK (company_id=public.current_company_id() AND public.is_company_manager() AND public.member_costing_can());