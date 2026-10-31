CREATE OR REPLACE FUNCTION public.guard_record_identifier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.company_identifier_rules; v text; oldv text; k text; col text; BEGIN
 k:=CASE TG_TABLE_NAME WHEN 'company_tools' THEN 'tool' WHEN 'assets' THEN 'asset' WHEN 'inventory_items' THEN 'part' ELSE 'site' END;
 col:=CASE k WHEN 'tool' THEN 'tag' WHEN 'asset' THEN 'reference_number' WHEN 'part' THEN 'sku' ELSE 'store_code' END;
 v:=to_jsonb(NEW)->>col;
 IF TG_OP='UPDATE' THEN oldv:=to_jsonb(OLD)->>col; IF v IS NOT DISTINCT FROM oldv AND NEW.company_id=OLD.company_id THEN RETURN NEW; END IF; END IF;
 SELECT * INTO r FROM public.company_identifier_rules WHERE company_id=NEW.company_id AND kind=k; IF NOT FOUND THEN RETURN NEW; END IF;
 v:=trim(coalesce(v,'')); IF r.uppercase THEN v:=upper(v); END IF;
 IF r.strict AND NOT public.check_identifier_rule(v,r) THEN RAISE EXCEPTION 'Identifier does not match the company % format',k; END IF;
 NEW:=jsonb_populate_record(NEW,jsonb_build_object(col,v));RETURN NEW;
END $$;