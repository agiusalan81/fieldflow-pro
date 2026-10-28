DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.platform_clean_slate(uuid,text,boolean)'::regprocedure) INTO definition;
 definition=replace(definition,'UPDATE public.daily_work_reports SET superseded_by=NULL WHERE company_id=_company;','UPDATE public.daily_work_reports SET shift_id=NULL,superseded_by=NULL WHERE company_id=_company;'); EXECUTE definition;
 SELECT pg_get_functiondef('public.platform_reset_test_data(uuid,text,text[],boolean)'::regprocedure) INTO definition;
 definition=replace(definition,'UPDATE public.daily_work_reports SET superseded_by=NULL WHERE company_id=_company AND superseded_by IS NOT NULL;','UPDATE public.daily_work_reports SET shift_id=NULL,superseded_by=NULL WHERE company_id=_company;'); EXECUTE definition;
END $migration$;