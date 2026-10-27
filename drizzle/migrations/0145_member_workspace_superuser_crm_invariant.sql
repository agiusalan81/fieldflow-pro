CREATE OR REPLACE FUNCTION public.set_member_workspaces(_user uuid,_estimates boolean,_contracts boolean,_field boolean,_crm text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target public.user_roles; BEGIN
 SELECT * INTO target FROM public.user_roles WHERE user_id=_user AND company_id=public.current_company_id() FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) OR NOT(public.my_role()='superuser' OR (public.my_role()='admin' AND target.role<>'superuser')) THEN RAISE EXCEPTION 'Company office admin access required'; END IF;
 PERFORM public.set_member_capabilities(_user,_field,target.can_commercial_access);
 IF target.role='superuser' THEN IF _crm IS DISTINCT FROM 'manager' THEN RAISE EXCEPTION 'Company superusers always have full CRM access'; END IF;
 ELSE PERFORM public.set_member_crm_access(_user,_crm); END IF;
 UPDATE public.user_roles SET can_estimates=_estimates,can_contracts=_contracts WHERE user_id=_user AND company_id=public.current_company_id();
 END $$;