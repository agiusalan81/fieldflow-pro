CREATE OR REPLACE FUNCTION public.guard_custom_request() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sample jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.company_id,NEW.product_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.product_id,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Request identity cannot change'; END IF;
  IF public.is_platform_owner() AND OLD.status<>'draft' THEN
   IF NEW.status='draft' OR ROW(NEW.title,NEW.category,NEW.notes,NEW.target_date,NEW.samples) IS DISTINCT FROM ROW(OLD.title,OLD.category,OLD.notes,OLD.target_date,OLD.samples) THEN RAISE EXCEPTION 'Submitted requirements cannot be rewritten by HQ'; END IF;
  ELSIF OLD.status<>'draft' OR NEW.status NOT IN ('draft','submitted') OR NEW.response<>OLD.response OR NEW.quoted_price IS DISTINCT FROM OLD.quoted_price OR NEW.company_id IS DISTINCT FROM public.current_company_id() OR public.my_role() IS DISTINCT FROM 'superuser'::public.app_role THEN RAISE EXCEPTION 'Only own-company superuser draft requirements can be changed'; END IF;
 END IF;
 FOR sample IN SELECT value FROM jsonb_array_elements(NEW.samples) LOOP
  IF jsonb_typeof(sample)<>'object' OR coalesce(sample->>'path','') NOT LIKE NEW.company_id::text||'/'||NEW.id::text||'/%' OR coalesce(sample->>'name','')='' OR length(sample->>'name')>255 OR coalesce((sample->>'size')::bigint,0) NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Invalid sample document'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='bespoke-samples' AND name=sample->>'path') THEN RAISE EXCEPTION 'Sample upload is missing'; END IF;
 END LOOP;
 NEW.updated_at=now(); RETURN NEW;
END $$;