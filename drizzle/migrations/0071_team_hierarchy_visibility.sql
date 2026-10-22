CREATE OR REPLACE FUNCTION public.registered_members() RETURNS TABLE(id uuid,full_name text,email text,employee_id text,role public.app_role,platform_owner boolean,created_at timestamptz,registration_status text,terminated_at timestamptz,termination_reason text,providers text[]) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE me public.app_role:=public.my_role(); BEGIN
 IF NOT public.is_company_manager() THEN RAISE EXCEPTION 'Only managers can view registered members'; END IF;
 RETURN QUERY SELECT u.id,u.full_name,u.email,u.employee_id,r.role,r.platform_owner,u.created_at,r.registration_status,r.terminated_at,CASE WHEN public.has_company_role('admin') THEN r.termination_reason ELSE NULL END,ARRAY(SELECT DISTINCT i.provider::text FROM auth.identities i WHERE i.user_id=u.id)
 FROM public.users u JOIN public.user_roles r ON r.user_id=u.id AND r.company_id=u.company_id
 WHERE u.company_id=public.current_company_id()
   AND (me='superuser' OR (me='admin' AND r.role IN ('admin','supervisor','technician')) OR (me='supervisor' AND r.role IN ('supervisor','technician')))
 ORDER BY u.full_name;
 END $$;
REVOKE ALL ON FUNCTION public.registered_members() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registered_members() TO authenticated;