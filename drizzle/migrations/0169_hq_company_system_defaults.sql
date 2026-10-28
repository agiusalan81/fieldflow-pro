DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.platform_create_company(uuid,text,boolean,uuid,text,numeric,integer,uuid[])'::regprocedure) INTO definition;
 definition=replace(definition,'DECLARE co uuid; s uuid;','DECLARE co uuid; s uuid; actor uuid=auth.uid(); jwt text=current_setting(''request.jwt.claims'',true); sub text=current_setting(''request.jwt.claim.sub'',true);');
 definition=replace(definition,'INSERT INTO public.company_settings(company_id) VALUES(co) ON CONFLICT(company_id) DO NOTHING;','PERFORM set_config(''request.jwt.claims'','''',true); PERFORM set_config(''request.jwt.claim.sub'','''',true); INSERT INTO public.company_settings(company_id) VALUES(co) ON CONFLICT(company_id) DO NOTHING; PERFORM set_config(''request.jwt.claims'',coalesce(jwt,''''),true); PERFORM set_config(''request.jwt.claim.sub'',coalesce(sub,''''),true);');
 EXECUTE definition;
END $migration$;