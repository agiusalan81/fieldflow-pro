CREATE OR REPLACE FUNCTION public.guard_client_management_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE company uuid; client uuid; scope jsonb;
BEGIN
 IF auth.uid() IS NULL THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 company:=CASE WHEN TG_OP='DELETE' THEN OLD.company_id ELSE NEW.company_id END;
 client:=CASE WHEN TG_OP='DELETE' THEN OLD.client_id ELSE NEW.client_id END;
 IF company=public.current_company_id() AND public.member_is_active(auth.uid()) AND public.is_company_manager() THEN
  IF NOT public.company_module_access(company,'core') THEN RAISE EXCEPTION 'Company is read-only'; END IF;
  IF NOT public.company_module_access(company,'client_management') THEN
   IF TG_TABLE_NAME='sites' OR (TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.client_contacts WHERE client_id=client AND company_id=company)) THEN RAISE EXCEPTION 'Sites and multiple contacts require Client management'; END IF;
  END IF;
 ELSE
  IF TG_TABLE_NAME='sites' OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Only contractor staff may change sites or delete contacts'; END IF;
  scope:=public.client_workspace_scope(client);
  IF (scope->>'office')::boolean THEN RAISE EXCEPTION 'Active company access required'; END IF;
  IF TG_OP='UPDATE' AND (NEW.site_id,NEW.all_sites,NEW.site_ids) IS DISTINCT FROM (OLD.site_id,OLD.all_sites,OLD.site_ids) THEN RAISE EXCEPTION 'Only contractor staff may change site assignments'; END IF;
  IF TG_OP='INSERT' AND (NOT (scope->>'admin')::boolean OR NEW.all_sites IS DISTINCT FROM (scope->>'all_sites')::boolean OR NOT (NEW.site_ids @> ARRAY(SELECT jsonb_array_elements_text(scope->'site_ids')::uuid) AND NEW.site_ids <@ ARRAY(SELECT jsonb_array_elements_text(scope->'site_ids')::uuid))) THEN RAISE EXCEPTION 'New contacts inherit your assigned sites'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER zz_client_management_access BEFORE INSERT OR UPDATE OR DELETE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION public.guard_client_management_access();
CREATE TRIGGER sites_client_management_access BEFORE INSERT OR UPDATE OR DELETE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.guard_client_management_access();
REVOKE ALL ON FUNCTION public.guard_client_management_access() FROM PUBLIC,anon;

DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.save_client_contact(uuid,uuid,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF NOT (scope->>''admin'')::boolean THEN','IF NOT (scope->>''office'')::boolean THEN
 IF _contact IS NOT NULL AND (allsites IS DISTINCT FROM c.all_sites OR NOT (ids @> c.site_ids AND ids <@ c.site_ids)) THEN RAISE EXCEPTION ''Only contractor staff may change site assignments''; END IF;
 IF _contact IS NULL THEN allsites:=(scope->>''all_sites'')::boolean; SELECT coalesce(array_agg(value::uuid),''{}''::uuid[]) INTO ids FROM jsonb_array_elements_text(scope->''site_ids''); END IF;
 END IF;
 IF NOT (scope->>''admin'')::boolean THEN');
 -- Preserve a legacy site_id on portal edits instead of recalculating it.
 definition:=replace(definition,'site_id=CASE WHEN allsites THEN NULL ELSE ids[1] END','site_id=CASE WHEN NOT (scope->>''office'')::boolean THEN c.site_id WHEN allsites THEN NULL ELSE ids[1] END');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.client_message_recipients(uuid,uuid,text,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'advanced:=public.company_module_access(c.company_id,''client_portal'');','advanced:=public.company_module_access(c.company_id,''client_management'');');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.create_client_setup(jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF address<>'''' THEN','IF address<>'''' AND public.company_module_access(company,''client_management'') THEN');
 EXECUTE definition;
END $$;

CREATE OR REPLACE FUNCTION public.register_catalog_modules() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND (NOT public.is_platform_owner() OR NOT public.member_is_active(auth.uid())) THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.modules) m WHERE m IS NULL OR m !~ '^[a-z][a-z0-9_]{0,99}$') THEN RAISE EXCEPTION 'Invalid module key'; END IF;
 IF NEW.kind='plan' AND NOT ('core'=ANY(NEW.modules)) THEN RAISE EXCEPTION 'Core is included in every tier'; END IF;
 UPDATE public.platform_products SET modules=ARRAY(SELECT DISTINCT m FROM unnest(modules||NEW.modules) m ORDER BY m) WHERE id=NEW.product_id;
 RETURN NEW;
END $$;
CREATE TRIGGER catalog_register_modules BEFORE INSERT OR UPDATE OF modules ON public.platform_catalog FOR EACH ROW EXECUTE FUNCTION public.register_catalog_modules();
REVOKE ALL ON FUNCTION public.register_catalog_modules() FROM PUBLIC,anon;
CREATE OR REPLACE FUNCTION public.set_catalog_module(_catalog uuid,_module text,_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE c public.platform_catalog; BEGIN
 IF auth.uid() IS NULL OR NOT public.is_platform_owner() OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF _enabled IS NULL OR _module IS NULL OR _module !~ '^[a-z][a-z0-9_]{0,99}$' THEN RAISE EXCEPTION 'Choose a valid feature and state'; END IF;
 SELECT * INTO c FROM public.platform_catalog WHERE id=_catalog FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Catalog item unavailable'; END IF;
 IF c.kind='plan' AND _module='core' AND NOT _enabled THEN RAISE EXCEPTION 'Core is included in every tier'; END IF;
 UPDATE public.platform_catalog SET modules=CASE WHEN _enabled THEN ARRAY(SELECT DISTINCT m FROM unnest(c.modules||ARRAY[_module]) m ORDER BY m) ELSE array_remove(c.modules,_module) END WHERE id=c.id;
END $$;
REVOKE ALL ON FUNCTION public.set_catalog_module(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_catalog_module(uuid,text,boolean) TO authenticated;