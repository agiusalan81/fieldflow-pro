CREATE OR REPLACE FUNCTION public.my_commercial_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s public.platform_subscriptions; p public.platform_products;
BEGIN
 SELECT * INTO p FROM public.platform_products WHERE id=public.company_app_product_id();
 SELECT * INTO s FROM public.platform_subscriptions WHERE company_id=public.current_company_id() AND product_id=p.id LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','legacy','writable',true,'modules','[]'::jsonb); END IF;
 RETURN jsonb_build_object('state',CASE WHEN s.status='trial' AND s.trial_ends_at<=now() THEN 'read_only' WHEN s.status IN ('trial','active') AND public.company_invoice_lapsed(s.id) THEN 'read_only' ELSE s.status END,'subscription_status',s.status,'plan_id',s.plan_id,'pack_ids',s.pack_ids,'cadence',s.cadence,'seats',s.seats,'agreed_price',s.agreed_price,'trial_package_only',s.trial_package_only,'pending_change',s.pending_change,'invoice_lapsed',public.company_invoice_lapsed(s.id),'trial_ends_at',s.trial_ends_at,'writable',public.company_module_access(s.company_id,'core'),'modules',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',m,'enabled',public.company_module_access(s.company_id,m))),'[]'::jsonb) FROM (SELECT unnest(p.modules) m UNION SELECT module FROM public.platform_overrides WHERE subscription_id=s.id) listed),'branding',(SELECT branding_required FROM public.platform_catalog WHERE id=s.plan_id));
END $function$;
CREATE TABLE public.platform_custom_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id), product_id uuid NOT NULL DEFAULT public.company_app_product_id() REFERENCES public.platform_products(id), created_by uuid NOT NULL DEFAULT auth.uid(), title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160), category text NOT NULL CHECK(category IN ('estimate_template','proposal_template','job_sheet_template','checklist','integration','custom_module','plan_change','storage_change')), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=10000), target_date date, samples jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(samples)='array' AND jsonb_array_length(samples)<=5), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','in_review','quoted','in_progress','delivered','declined')), response text NOT NULL DEFAULT '' CHECK(length(response)<=10000), quoted_price numeric CHECK(quoted_price>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.platform_custom_requests TO authenticated;
GRANT ALL ON public.platform_custom_requests TO service_role;
ALTER TABLE public.platform_custom_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_request_read ON public.platform_custom_requests FOR SELECT TO authenticated USING (public.is_platform_owner() OR (company_id=public.current_company_id() AND public.my_role()='superuser'));
CREATE POLICY custom_request_insert ON public.platform_custom_requests FOR INSERT TO authenticated WITH CHECK(company_id=public.current_company_id() AND product_id=public.company_app_product_id() AND public.my_role()='superuser' AND created_by=auth.uid() AND status='draft' AND response='' AND quoted_price IS NULL);
CREATE POLICY custom_request_update ON public.platform_custom_requests FOR UPDATE TO authenticated USING(public.is_platform_owner() OR (company_id=public.current_company_id() AND public.my_role()='superuser' AND status='draft')) WITH CHECK(public.is_platform_owner() OR (company_id=public.current_company_id() AND public.my_role()='superuser' AND status IN ('draft','submitted')));
CREATE POLICY custom_request_delete ON public.platform_custom_requests FOR DELETE TO authenticated USING(company_id=public.current_company_id() AND public.my_role()='superuser' AND status='draft');
CREATE FUNCTION public.guard_custom_request() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sample jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.company_id,NEW.product_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.product_id,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Request identity cannot change'; END IF;
  IF public.is_platform_owner() THEN
   IF ROW(NEW.title,NEW.category,NEW.notes,NEW.target_date,NEW.samples) IS DISTINCT FROM ROW(OLD.title,OLD.category,OLD.notes,OLD.target_date,OLD.samples) THEN RAISE EXCEPTION 'Submitted requirements cannot be rewritten by HQ'; END IF;
  ELSIF OLD.status<>'draft' OR NEW.status NOT IN ('draft','submitted') OR NEW.response<>OLD.response OR NEW.quoted_price IS DISTINCT FROM OLD.quoted_price THEN RAISE EXCEPTION 'Only draft requirements can be changed'; END IF;
 END IF;
 FOR sample IN SELECT value FROM jsonb_array_elements(NEW.samples) LOOP
  IF jsonb_typeof(sample)<>'object' OR coalesce(sample->>'path','') NOT LIKE NEW.company_id::text||'/'||NEW.id::text||'/%' OR coalesce(sample->>'name','')='' OR length(sample->>'name')>255 OR coalesce((sample->>'size')::bigint,0) NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Invalid sample document'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='bespoke-samples' AND name=sample->>'path') THEN RAISE EXCEPTION 'Sample upload is missing'; END IF;
 END LOOP;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER custom_request_guard BEFORE INSERT OR UPDATE ON public.platform_custom_requests FOR EACH ROW EXECUTE FUNCTION public.guard_custom_request();
CREATE TRIGGER custom_request_audit AFTER INSERT OR UPDATE OR DELETE ON public.platform_custom_requests FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();
CREATE POLICY bespoke_sample_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='bespoke-samples' AND EXISTS(SELECT 1 FROM public.platform_custom_requests r WHERE r.company_id::text=(storage.foldername(name))[1] AND r.id::text=(storage.foldername(name))[2] AND (public.is_platform_owner() OR (r.company_id=public.current_company_id() AND public.my_role()='superuser'))));
CREATE POLICY bespoke_sample_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='bespoke-samples' AND public.my_role()='superuser' AND EXISTS(SELECT 1 FROM public.platform_custom_requests r WHERE r.company_id=public.current_company_id() AND r.company_id::text=(storage.foldername(name))[1] AND r.id::text=(storage.foldername(name))[2] AND r.status='draft'));
CREATE POLICY bespoke_sample_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='bespoke-samples' AND public.my_role()='superuser' AND EXISTS(SELECT 1 FROM public.platform_custom_requests r WHERE r.company_id=public.current_company_id() AND r.company_id::text=(storage.foldername(name))[1] AND r.id::text=(storage.foldername(name))[2] AND r.status='draft'));
