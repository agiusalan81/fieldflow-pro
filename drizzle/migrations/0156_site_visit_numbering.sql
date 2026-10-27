ALTER TABLE public.site_surveys ADD COLUMN IF NOT EXISTS reference text;
CREATE OR REPLACE FUNCTION public.assign_site_visit_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r text; n bigint;
BEGIN
  IF NEW.reference IS NOT NULL OR NEW.company_id IS NULL THEN RETURN NEW; END IF;
  r := public.next_document_number(NEW.company_id,'site_visit');
  IF r IS NULL THEN
    INSERT INTO public.company_number_counters(company_id,kind,next_value) VALUES(NEW.company_id,'site_visit',2)
      ON CONFLICT(company_id,kind) DO UPDATE SET next_value=company_number_counters.next_value+1 RETURNING next_value-1 INTO n;
    r := 'VIS-'||lpad(n::text,greatest(4,length(n::text)),'0');
  END IF;
  NEW.reference := r; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS site_surveys_assign_number ON public.site_surveys;
CREATE TRIGGER site_surveys_assign_number BEFORE INSERT ON public.site_surveys FOR EACH ROW EXECUTE FUNCTION public.assign_site_visit_number();
CREATE OR REPLACE FUNCTION public.save_document_numbering(_config jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c uuid := public.current_company_id(); k text; v jsonb; n bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) OR public.my_role() NOT IN ('superuser','admin') THEN RAISE EXCEPTION 'Office admin access required'; END IF;
  IF _config IS NULL OR jsonb_typeof(_config) <> 'object' THEN RAISE EXCEPTION 'Invalid numbering'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(_config) LOOP
    IF k NOT IN ('estimate','quote','proposal','job_sheet','invoice','site_visit') OR jsonb_typeof(v) <> 'object'
      OR coalesce(v->>'prefix','') !~ '^[A-Za-z0-9/_.#-]{0,12}$'
      OR coalesce((v->>'padding')::int, -1) NOT BETWEEN 1 AND 10
      OR coalesce((v->>'next')::bigint, 0) NOT BETWEEN 1 AND 999999999 THEN RAISE EXCEPTION 'Check prefix (max 12 letters/numbers), digits (1–10) and start number for %', k; END IF;
    n := (v->>'next')::bigint;
    INSERT INTO public.company_number_counters(company_id, kind, next_value) VALUES (c, k, n)
      ON CONFLICT (company_id, kind) DO UPDATE SET next_value = EXCLUDED.next_value;
  END LOOP;
  UPDATE public.company_settings SET numbering = _config WHERE company_id = c;
END $function$;