ALTER TABLE public.company_identifier_rules
  ADD COLUMN IF NOT EXISTS use_equipment_prefixes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipment_prefixes jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.company_identifier_rules ADD CONSTRAINT company_identifier_rules_equipment_prefixes_object CHECK (jsonb_typeof(equipment_prefixes)='object') NOT VALID;

CREATE OR REPLACE FUNCTION public.check_identifier_rule(_value text, _rule company_identifier_rules)
 RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$ DECLARE body text; lead text:=_rule.prefix||_rule.separator; m text; BEGIN
 IF _rule.kind='asset' AND _rule.use_equipment_prefixes THEN
   m:=substring(_value from '^([A-Za-z0-9]{1,6})'||regexp_replace(_rule.separator,'([^A-Za-z0-9])','\\\1','g'));
   IF m IS NULL THEN RETURN false; END IF; lead:=m||_rule.separator;
 END IF;
 IF left(_value,length(lead))<>lead THEN RETURN false; END IF; body:=substr(_value,length(lead)+1);
 IF _rule.pattern_type='numeric' THEN RETURN body ~ ('^[0-9]{'||_rule.padding||',}$'); ELSIF _rule.pattern_type='alphanumeric' THEN RETURN body ~ '^[A-Za-z0-9]+$'; ELSE RETURN length(_rule.pattern)>0 AND body ~ ('^('||_rule.pattern||')$'); END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.populate_space_assets(_site uuid, _rows jsonb)
 RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE c uuid:=public.current_company_id(); s public.sites; r public.company_identifier_rules; item jsonb; tag text; lead text; n bigint; p text; counters jsonb:='{}'; a uuid; ids uuid[]:='{}'; BEGIN
 IF NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() THEN RAISE EXCEPTION 'Manager access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_products pp WHERE pp.id=public.company_product_id(c) AND pp.engine_edition IN ('hotel','retail')) THEN RAISE EXCEPTION 'Available for Hotels and AisleOps only'; END IF;
 SELECT * INTO s FROM public.sites WHERE id=_site AND company_id=c; IF NOT FOUND THEN RAISE EXCEPTION 'Choose a valid property first'; END IF;
 IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Choose between 1 and 10000 items per batch'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c::text||':asset-identifiers',0));
 SELECT * INTO r FROM public.company_identifier_rules WHERE company_id=c AND kind='asset';
 IF FOUND AND r.pattern_type<>'numeric' THEN RAISE EXCEPTION 'Automatic asset creation requires a number sequence in company ID formats'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  IF length(coalesce(item->>'asset_category','')) NOT BETWEEN 1 AND 200 OR length(coalesce(item->>'location_details','')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter equipment and location'; END IF;
  IF r.company_id IS NOT NULL THEN
   p:=r.prefix;
   IF r.use_equipment_prefixes THEN p:=upper(coalesce(item->>'prefix','')); IF p !~ '^[A-Z0-9]{1,6}$' THEN RAISE EXCEPTION 'Equipment prefix must be 1-6 letters or numbers'; END IF; END IF;
   lead:=p||r.separator;
   IF counters ? lead THEN n:=(counters->>lead)::bigint; ELSE
    SELECT coalesce(max(substr(reference_number,length(lead)+1)::bigint),0) INTO n FROM public.assets WHERE company_id=c AND left(reference_number,length(lead))=lead AND substr(reference_number,length(lead)+1) ~ '^[0-9]{1,12}$';
   END IF;
   n:=n+1; counters:=counters||jsonb_build_object(lead,n); tag:=lead||lpad(n::text,greatest(r.padding,length(n::text)),'0');
  ELSE tag:=trim(item->>'reference_number'); END IF;
  IF tag IS NULL OR tag='' OR EXISTS(SELECT 1 FROM public.assets WHERE company_id=c AND reference_number=tag) THEN RAISE EXCEPTION 'Duplicate or missing asset ID: %. Set an asset numbering rule or change the layout',tag; END IF;
  INSERT INTO public.assets(company_id,client_id,site_id,reference_number,asset_category,location_details) VALUES(c,s.client_id,s.id,tag,item->>'asset_category',item->>'location_details') RETURNING id INTO a; ids:=array_append(ids,a);
 END LOOP; RETURN ids;
END $function$;