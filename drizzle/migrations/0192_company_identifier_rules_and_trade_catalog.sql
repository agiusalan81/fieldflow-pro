CREATE TABLE public.company_identifier_rules (
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('tool','asset','part','site')), prefix text NOT NULL DEFAULT '', separator text NOT NULL DEFAULT '-', padding integer NOT NULL DEFAULT 2 CHECK(padding BETWEEN 1 AND 10), pattern_type text NOT NULL DEFAULT 'numeric' CHECK(pattern_type IN ('numeric','alphanumeric','regex')), pattern text NOT NULL DEFAULT '', uppercase boolean NOT NULL DEFAULT true, strict boolean NOT NULL DEFAULT false, PRIMARY KEY(company_id,kind)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.company_identifier_rules TO authenticated;
GRANT ALL ON public.company_identifier_rules TO service_role;
ALTER TABLE public.company_identifier_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY identifier_read ON public.company_identifier_rules FOR SELECT TO authenticated USING(company_id=public.current_company_id());
CREATE POLICY identifier_write ON public.company_identifier_rules FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.my_role() IN ('superuser','admin')) WITH CHECK(company_id=public.current_company_id() AND public.my_role() IN ('superuser','admin'));
CREATE FUNCTION public.check_identifier_rule(_value text,_rule public.company_identifier_rules) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ DECLARE body text; lead text:=_rule.prefix||_rule.separator; BEGIN
 IF left(_value,length(lead))<>lead THEN RETURN false; END IF; body:=substr(_value,length(lead)+1);
 IF _rule.pattern_type='numeric' THEN RETURN body ~ ('^[0-9]{'||_rule.padding||',}$'); ELSIF _rule.pattern_type='alphanumeric' THEN RETURN body ~ '^[A-Za-z0-9]+$'; ELSE RETURN length(_rule.pattern)>0 AND body ~ ('^('||_rule.pattern||')$'); END IF;
END $$;
CREATE FUNCTION public.guard_identifier_rule() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF length(NEW.prefix)>24 OR length(NEW.separator)>3 OR length(NEW.pattern)>120 THEN RAISE EXCEPTION 'Identifier format too long'; END IF;
 IF NEW.uppercase THEN NEW.prefix:=upper(NEW.prefix); END IF;
 IF NEW.pattern_type='regex' THEN IF NEW.pattern='' THEN RAISE EXCEPTION 'Enter a pattern'; END IF; PERFORM '' ~ NEW.pattern; END IF; RETURN NEW;
END $$;
CREATE TRIGGER identifier_rule_guard BEFORE INSERT OR UPDATE ON public.company_identifier_rules FOR EACH ROW EXECUTE FUNCTION public.guard_identifier_rule();
CREATE FUNCTION public.guard_record_identifier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.company_identifier_rules; v text; oldv text; k text; BEGIN
 k:=CASE TG_TABLE_NAME WHEN 'company_tools' THEN 'tool' WHEN 'assets' THEN 'asset' WHEN 'inventory_items' THEN 'part' ELSE 'site' END;
 v:=CASE k WHEN 'tool' THEN NEW.tag WHEN 'asset' THEN NEW.reference_number WHEN 'part' THEN NEW.sku ELSE NEW.store_code END;
 IF TG_OP='UPDATE' THEN oldv:=CASE k WHEN 'tool' THEN OLD.tag WHEN 'asset' THEN OLD.reference_number WHEN 'part' THEN OLD.sku ELSE OLD.store_code END; IF v IS NOT DISTINCT FROM oldv AND NEW.company_id=OLD.company_id THEN RETURN NEW; END IF; END IF;
 SELECT * INTO r FROM public.company_identifier_rules WHERE company_id=NEW.company_id AND kind=k; IF NOT FOUND THEN RETURN NEW; END IF;
 v:=trim(coalesce(v,'')); IF r.uppercase THEN v:=upper(v); END IF;
 IF r.strict AND NOT public.check_identifier_rule(v,r) THEN RAISE EXCEPTION 'Identifier does not match the company % format',k; END IF;
 IF k='tool' THEN NEW.tag:=v; ELSIF k='asset' THEN NEW.reference_number:=v; ELSIF k='part' THEN NEW.sku:=v; ELSE NEW.store_code:=v; END IF; RETURN NEW;
END $$;
CREATE TRIGGER zz_tool_identifier BEFORE INSERT OR UPDATE ON public.company_tools FOR EACH ROW EXECUTE FUNCTION public.guard_record_identifier();
CREATE TRIGGER zz_asset_identifier BEFORE INSERT OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.guard_record_identifier();
CREATE TRIGGER zz_part_identifier BEFORE INSERT OR UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.guard_record_identifier();
CREATE TRIGGER zz_site_identifier BEFORE INSERT OR UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.guard_record_identifier();
CREATE TABLE public.operating_service_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, category text NOT NULL, service text NOT NULL, approved boolean NOT NULL DEFAULT false, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), CHECK(length(category) BETWEEN 1 AND 100), CHECK(length(service) BETWEEN 1 AND 100), CHECK(company_id IS NOT NULL OR approved)
);
CREATE UNIQUE INDEX operating_service_unique ON public.operating_service_catalog(coalesce(company_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(category),lower(service));
GRANT SELECT,INSERT,DELETE ON public.operating_service_catalog TO authenticated;
GRANT ALL ON public.operating_service_catalog TO service_role;
ALTER TABLE public.operating_service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_read ON public.operating_service_catalog FOR SELECT TO authenticated USING(company_id=public.current_company_id() OR (company_id IS NULL AND approved) OR public.is_platform_owner());
CREATE POLICY service_insert ON public.operating_service_catalog FOR INSERT TO authenticated WITH CHECK(company_id=public.current_company_id() AND public.my_role() IN ('superuser','admin') AND NOT approved AND created_by=auth.uid());
CREATE POLICY service_delete ON public.operating_service_catalog FOR DELETE TO authenticated USING(company_id=public.current_company_id() AND public.my_role() IN ('superuser','admin'));
CREATE FUNCTION public.hq_promote_operating_service(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.operating_service_catalog; BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform owner access required'; END IF;
 SELECT * INTO s FROM public.operating_service_catalog WHERE id=_id; IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
 INSERT INTO public.operating_service_catalog(company_id,category,service,approved,created_by) VALUES(NULL,s.category,s.service,true,auth.uid()) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.hq_promote_operating_service(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hq_promote_operating_service(uuid) TO authenticated;