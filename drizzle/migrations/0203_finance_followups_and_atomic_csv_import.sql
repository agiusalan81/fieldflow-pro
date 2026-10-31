ALTER TABLE public.client_billing_settings ADD COLUMN reminder_rules jsonb NOT NULL DEFAULT '{}';
CREATE TABLE public.finance_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id),
 billing_id uuid REFERENCES public.client_billing_documents(id), quote_id uuid REFERENCES public.customer_quotes(id),
 paused boolean NOT NULL DEFAULT false, snoozed_until date, completed_stages text[] NOT NULL DEFAULT '{}', activity jsonb NOT NULL DEFAULT '[]',
 CONSTRAINT one_followup_target CHECK ((billing_id IS NOT NULL)::int+(quote_id IS NOT NULL)::int=1), UNIQUE(billing_id), UNIQUE(quote_id)
);
GRANT SELECT,INSERT,UPDATE ON public.finance_followups TO authenticated;
GRANT ALL ON public.finance_followups TO service_role;
ALTER TABLE public.finance_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_office ON public.finance_followups FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.client_billing_can()) WITH CHECK(company_id=public.current_company_id() AND public.client_billing_can());
CREATE FUNCTION public.guard_finance_followup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.client_billing_can() OR NOT public.company_module_access(public.current_company_id(),'core') OR NEW.company_id IS DISTINCT FROM public.current_company_id() THEN RAISE EXCEPTION 'Contractor office access required'; END IF;
 IF NEW.billing_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.client_billing_documents WHERE id=NEW.billing_id AND company_id=NEW.company_id AND issued_at IS NOT NULL) THEN RAISE EXCEPTION 'Issued billing document required'; END IF;
 IF NEW.quote_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.customer_quotes WHERE id=NEW.quote_id AND company_id=NEW.company_id AND issued_at IS NOT NULL) THEN RAISE EXCEPTION 'Issued quote required'; END IF;
 IF TG_OP='UPDATE' AND (NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.billing_id IS DISTINCT FROM OLD.billing_id OR NEW.quote_id IS DISTINCT FROM OLD.quote_id) THEN RAISE EXCEPTION 'Follow-up identity is fixed'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER finance_followup_guard BEFORE INSERT OR UPDATE ON public.finance_followups FOR EACH ROW EXECUTE FUNCTION public.guard_finance_followup();
CREATE FUNCTION public.import_company_csv(_kind text,_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid:=public.current_company_id(); item jsonb; cid uuid; sid uuid; aid uuid; count_matches int; added int:=0; skipped int:=0; ids uuid[]:='{}'; label text; tag text;
BEGIN
 IF NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() OR NOT public.company_module_access(c,'core') THEN RAISE EXCEPTION 'Active manager and Core access required'; END IF;
 IF _kind NOT IN ('clients','sites','equipment','rooms') OR jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Choose 1–1000 valid rows'; END IF;
 IF _kind='rooms' AND NOT EXISTS(SELECT 1 FROM public.platform_products WHERE id=public.company_product_id(c) AND engine_edition='hotel') THEN RAISE EXCEPTION 'Room import is available for Hotels only'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c::text||':csv-import',0));
 PERFORM pg_advisory_xact_lock(hashtextextended(c::text||':asset-identifiers',0));
 FOR item IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  IF _kind='clients' THEN
   label:=trim(item->>'name'); IF label IS NULL OR length(label) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Client name required'; END IF;
   SELECT count(*) INTO count_matches FROM public.clients WHERE company_id=c AND lower(trim(name))=lower(label);
   IF count_matches>1 THEN RAISE EXCEPTION 'Ambiguous client: %',label; END IF;
   IF count_matches=1 THEN skipped:=skipped+1; CONTINUE; END IF;
   INSERT INTO public.clients(company_id,name,billing_address) VALUES(c,label,nullif(trim(item->>'address'),'')) RETURNING id INTO aid;
  ELSE
   SELECT count(*),(array_agg(id))[1] INTO count_matches,cid FROM public.clients WHERE company_id=c AND lower(trim(name))=lower(trim(item->>'client'));
   IF count_matches<>1 THEN RAISE EXCEPTION 'Client missing or ambiguous: %',item->>'client'; END IF;
   IF _kind='sites' THEN
    label:=trim(item->>'name'); IF label IS NULL OR length(label) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Site name required'; END IF;
    SELECT count(*) INTO count_matches FROM public.sites WHERE company_id=c AND client_id=cid AND lower(trim(name))=lower(label);
    IF count_matches>1 THEN RAISE EXCEPTION 'Ambiguous site: %',label; END IF;
    IF count_matches=1 THEN skipped:=skipped+1; CONTINUE; END IF;
    INSERT INTO public.sites(company_id,client_id,name,address,store_code) VALUES(c,cid,label,nullif(trim(item->>'address'),''),nullif(trim(item->>'store_code'),'')) RETURNING id INTO aid;
   ELSE
    SELECT count(*),(array_agg(id))[1] INTO count_matches,sid FROM public.sites WHERE company_id=c AND client_id=cid AND lower(trim(name))=lower(trim(item->>'site'));
    IF count_matches<>1 THEN RAISE EXCEPTION 'Site missing or ambiguous: %',item->>'site'; END IF;
    tag:=trim(item->>'reference'); label:=CASE WHEN _kind='rooms' THEN 'Room' ELSE trim(item->>'category') END;
    IF tag IS NULL OR length(tag) NOT BETWEEN 1 AND 200 OR label IS NULL OR length(label) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Equipment ID and category required'; END IF;
    IF EXISTS(SELECT 1 FROM public.assets WHERE company_id=c AND lower(trim(reference_number))=lower(tag)) THEN skipped:=skipped+1; CONTINUE; END IF;
    INSERT INTO public.assets(company_id,client_id,site_id,reference_number,asset_category,location_details,serial_number) VALUES(c,cid,sid,tag,label,nullif(trim(item->>'location'),''),nullif(trim(item->>'serial'),'')) RETURNING id INTO aid;
   END IF;
  END IF;
  added:=added+1; ids:=array_append(ids,aid);
 END LOOP;
 RETURN jsonb_build_object('added',added,'skipped',skipped,'ids',ids);
END $$;
REVOKE ALL ON FUNCTION public.import_company_csv(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_company_csv(text,jsonb) TO authenticated;