DO $migration$
DECLARE definition text;
DECLARE old_guard text := 'IF auth.uid() IS NOT NULL AND NOT public.company_module_access(NEW.company_id,''client_portal'') AND';
DECLARE new_guard text := 'IF auth.uid() IS NOT NULL AND NOT (NEW.company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND public.is_company_manager() AND public.company_module_access(NEW.company_id,''core'')) AND NOT public.company_module_access(NEW.company_id,''client_portal'') AND';
BEGIN
 SELECT pg_get_functiondef('public.guard_contact_routing()'::regprocedure) INTO definition;
 IF position(old_guard IN definition)=0 THEN RAISE EXCEPTION 'Expected contact routing guard was not found'; END IF;
 EXECUTE replace(definition,old_guard,new_guard);
END $migration$;
COMMENT ON FUNCTION public.guard_contact_routing() IS 'Active tenant managers may maintain core contact delivery preferences without a portal pack; external portal access and invitations retain module and site-authority checks.';