CREATE OR REPLACE FUNCTION public.guard_component_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='DELETE' AND public.is_platform_owner() AND EXISTS(SELECT 1 FROM public.platform_company_controls WHERE company_id=OLD.company_id AND is_test) THEN RETURN OLD; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Component history is append-only'; END IF;
 IF NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT public.is_company_manager() OR NOT public.member_is_active(auth.uid()) OR NOT public.company_module_access(NEW.company_id,'ppm_automation') OR NOT public.company_module_access(NEW.company_id,'core') THEN RAISE EXCEPTION 'Enabled PPM pack and manager access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.assets WHERE id=NEW.asset_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Equipment unavailable'; END IF;
 IF NEW.warranty_until<NEW.event_date THEN RAISE EXCEPTION 'Warranty cannot end before the event'; END IF;
 NEW.created_by=auth.uid(); RETURN NEW;
END $$;
DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.platform_clean_slate(uuid,text,boolean)'::regprocedure) INTO definition;
 definition=replace(definition,'DELETE FROM public.asset_component_events WHERE company_id=_company;','PERFORM set_config(''request.jwt.claims'',coalesce(jwt,''''),true); PERFORM set_config(''request.jwt.claim.sub'',coalesce(sub,''''),true); DELETE FROM public.asset_component_events WHERE company_id=_company; PERFORM set_config(''request.jwt.claims'','''',true); PERFORM set_config(''request.jwt.claim.sub'','''',true);'); EXECUTE definition;
END $migration$;