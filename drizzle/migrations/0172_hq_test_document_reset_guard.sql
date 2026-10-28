DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.guard_document_master()'::regprocedure) INTO definition;
 definition=replace(definition,'IF TG_OP=''DELETE'' THEN IF','IF TG_OP=''DELETE'' AND public.is_platform_owner() AND EXISTS(SELECT 1 FROM public.platform_company_controls WHERE company_id=OLD.company_id AND is_test) THEN RETURN OLD; END IF; IF TG_OP=''DELETE'' THEN IF'); EXECUTE definition;
 SELECT pg_get_functiondef('public.platform_clean_slate(uuid,text,boolean)'::regprocedure) INTO definition;
 definition=replace(definition,'DELETE FROM public.document_masters WHERE company_id=_company;','PERFORM set_config(''request.jwt.claims'',coalesce(jwt,''''),true); PERFORM set_config(''request.jwt.claim.sub'',coalesce(sub,''''),true); DELETE FROM public.document_masters WHERE company_id=_company; PERFORM set_config(''request.jwt.claims'','''',true); PERFORM set_config(''request.jwt.claim.sub'','''',true);'); EXECUTE definition;
END $migration$;