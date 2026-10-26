ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS numbering jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.company_settings.numbering IS 'Per-document numbering formats: {estimate|proposal|job_sheet|invoice: {prefix, padding, next}}';

CREATE TABLE IF NOT EXISTS public.company_number_counters(
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('estimate','proposal','job_sheet','invoice')),
  next_value bigint NOT NULL CHECK (next_value >= 1),
  PRIMARY KEY(company_id, kind)
);
GRANT SELECT ON public.company_number_counters TO authenticated;
GRANT ALL ON public.company_number_counters TO service_role;
ALTER TABLE public.company_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY number_counters_read ON public.company_number_counters FOR SELECT TO authenticated USING (company_id = public.current_company_id());

-- Office managers save a format; the start number only resets the counter when it moves forward or none exists.
CREATE OR REPLACE FUNCTION public.save_document_numbering(_config jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid := public.current_company_id(); k text; v jsonb; n bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) OR public.my_role() NOT IN ('superuser','admin') THEN RAISE EXCEPTION 'Office admin access required'; END IF;
  IF _config IS NULL OR jsonb_typeof(_config) <> 'object' THEN RAISE EXCEPTION 'Invalid numbering'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(_config) LOOP
    IF k NOT IN ('estimate','proposal','job_sheet','invoice') OR jsonb_typeof(v) <> 'object'
      OR coalesce(v->>'prefix','') !~ '^[A-Za-z0-9/_.#-]{0,12}$'
      OR coalesce((v->>'padding')::int, -1) NOT BETWEEN 1 AND 10
      OR coalesce((v->>'next')::bigint, 0) NOT BETWEEN 1 AND 999999999 THEN RAISE EXCEPTION 'Check prefix (max 12 letters/numbers), digits (1–10) and start number for %', k; END IF;
    n := (v->>'next')::bigint;
    INSERT INTO public.company_number_counters(company_id, kind, next_value) VALUES (c, k, n)
      ON CONFLICT (company_id, kind) DO UPDATE SET next_value = EXCLUDED.next_value;
  END LOOP;
  UPDATE public.company_settings SET numbering = _config WHERE company_id = c;
END $$;
REVOKE ALL ON FUNCTION public.save_document_numbering(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document_numbering(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.next_document_number(_company uuid, _kind text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg jsonb; n bigint;
BEGIN
  SELECT numbering->_kind INTO cfg FROM public.company_settings WHERE company_id = _company;
  IF cfg IS NULL OR jsonb_typeof(cfg) <> 'object' THEN RETURN NULL; END IF;
  UPDATE public.company_number_counters SET next_value = next_value + 1 WHERE company_id = _company AND kind = _kind RETURNING next_value - 1 INTO n;
  IF n IS NULL THEN RETURN NULL; END IF;
  RETURN coalesce(cfg->>'prefix','') || lpad(n::text, greatest(coalesce((cfg->>'padding')::int, 4), length(n::text)), '0');
END $$;
REVOKE ALL ON FUNCTION public.next_document_number(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_quote_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text; parent text;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT reference INTO parent FROM public.customer_quotes WHERE id = NEW.parent_id;
    IF parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customer_quotes WHERE company_id = NEW.company_id AND reference = regexp_replace(parent, '-R[0-9]+$', '') || '-R' || NEW.revision) THEN
      NEW.reference := regexp_replace(parent, '-R[0-9]+$', '') || '-R' || NEW.revision; RETURN NEW;
    END IF;
  END IF;
  r := public.next_document_number(NEW.company_id, CASE WHEN NEW.data->>'kind' = 'proposal' THEN 'proposal' ELSE 'estimate' END);
  IF r IS NOT NULL THEN NEW.reference := r; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS customer_quotes_assign_number ON public.customer_quotes;
CREATE TRIGGER customer_quotes_assign_number BEFORE INSERT ON public.customer_quotes FOR EACH ROW EXECUTE FUNCTION public.assign_quote_number();

CREATE OR REPLACE FUNCTION public.assign_jobsheet_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text;
BEGIN
  r := public.next_document_number(NEW.company_id, 'job_sheet');
  IF r IS NOT NULL THEN NEW.jobsheet_number := r; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS job_sheets_assign_number ON public.job_sheets;
CREATE TRIGGER job_sheets_assign_number BEFORE INSERT ON public.job_sheets FOR EACH ROW EXECUTE FUNCTION public.assign_jobsheet_number();

-- Managers can delete any estimate/proposal that has not become a job; history rows cascade, revisions and CRM links detach.
CREATE OR REPLACE FUNCTION public.delete_customer_quote(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid := public.current_company_id(); q public.customer_quotes;
BEGIN
  IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() THEN RAISE EXCEPTION 'Office or supervisor access required'; END IF;
  SELECT * INTO q FROM public.customer_quotes WHERE id = _id AND company_id = c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
  IF q.job_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.jobs WHERE customer_quote_id = q.id) OR EXISTS (SELECT 1 FROM public.job_sheets WHERE customer_quote_id = q.id) THEN RAISE EXCEPTION 'This quote is linked to a job. Remove the job first.'; END IF;
  UPDATE public.customer_quotes SET parent_id = q.parent_id WHERE parent_id = q.id;
  DELETE FROM public.customer_quote_photos WHERE false;
  DELETE FROM public.customer_quotes WHERE id = q.id;
END $$;
REVOKE ALL ON FUNCTION public.delete_customer_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_customer_quote(uuid) TO authenticated;