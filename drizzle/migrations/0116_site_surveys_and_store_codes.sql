ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS store_code text;
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS survey_reviewer_mode text NOT NULL DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS survey_reviewer_user_id uuid,
  ADD COLUMN IF NOT EXISTS zoho_sync_direct boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS zoho_sync_supplier boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_client_management_access()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  IF TG_TABLE_NAME='sites' AND TG_OP='UPDATE'
     AND (to_jsonb(NEW)-'store_code') = (to_jsonb(OLD)-'store_code') THEN
   scope:=public.client_workspace_scope(client);
   IF COALESCE((scope->>'office')::boolean,false) THEN RAISE EXCEPTION 'Active company access required'; END IF;
   IF COALESCE((scope->>'all_sites')::boolean,false) OR (scope->'site_ids') ? NEW.id::text THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'This site is not assigned to you';
  END IF;
  IF TG_TABLE_NAME='sites' OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Only contractor staff may change sites or delete contacts'; END IF;
  scope:=public.client_workspace_scope(client);
  IF (scope->>'office')::boolean THEN RAISE EXCEPTION 'Active company access required'; END IF;
  IF TG_OP='UPDATE' AND (NEW.site_id,NEW.all_sites,NEW.site_ids) IS DISTINCT FROM (OLD.site_id,OLD.all_sites,OLD.site_ids) THEN RAISE EXCEPTION 'Only contractor staff may change site assignments'; END IF;
  IF TG_OP='INSERT' AND (NOT (scope->>'admin')::boolean OR NEW.all_sites IS DISTINCT FROM (scope->>'all_sites')::boolean OR NOT (NEW.site_ids @> ARRAY(SELECT jsonb_array_elements_text(scope->'site_ids')::uuid) AND NEW.site_ids <@ ARRAY(SELECT jsonb_array_elements_text(scope->'site_ids')::uuid))) THEN RAISE EXCEPTION 'New contacts inherit your assigned sites'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.portal_set_site_store_code(_site uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF length(coalesce(_code,'')) > 40 THEN RAISE EXCEPTION 'Branch ID is too long'; END IF;
 UPDATE public.sites SET store_code = NULLIF(trim(_code),'') WHERE id=_site;
 IF NOT FOUND THEN RAISE EXCEPTION 'Site not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.portal_set_site_store_code(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.portal_set_site_store_code(uuid,text) TO authenticated;

CREATE TABLE public.site_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  location_ref text,
  survey_purpose text NOT NULL DEFAULT 'repair',
  track text NOT NULL DEFAULT 'direct' CHECK (track IN ('direct','supplier_rfq')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','priced','converted','rejected')),
  access_notes text, working_window text, hazards text[] NOT NULL DEFAULT '{}',
  scope_summary text, recommended_action text, urgency text NOT NULL DEFAULT 'routine',
  labour_hours numeric, technicians integer,
  materials jsonb NOT NULL DEFAULT '[]', other_items jsonb NOT NULL DEFAULT '[]',
  reviewer_id uuid, created_by uuid NOT NULL DEFAULT auth.uid(),
  pricing jsonb NOT NULL DEFAULT '{}', zoho_sync boolean,
  submitted_at timestamptz, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_surveys TO authenticated;
GRANT ALL ON public.site_surveys TO service_role;
ALTER TABLE public.site_surveys ENABLE ROW LEVEL SECURITY;
CREATE INDEX site_surveys_company_idx ON public.site_surveys(company_id, status);
CREATE POLICY "survey read" ON public.site_surveys FOR SELECT TO authenticated
 USING (company_id=public.current_company_id() AND (public.is_company_manager() OR created_by=auth.uid() OR reviewer_id=auth.uid()));
CREATE POLICY "survey insert" ON public.site_surveys FOR INSERT TO authenticated
 WITH CHECK (company_id=public.current_company_id() AND created_by=auth.uid() AND public.member_is_active(auth.uid()) AND public.company_module_access(company_id,'estimates'));
CREATE POLICY "survey update" ON public.site_surveys FOR UPDATE TO authenticated
 USING (company_id=public.current_company_id() AND (public.is_company_manager() OR reviewer_id=auth.uid() OR (created_by=auth.uid() AND status='draft')))
 WITH CHECK (company_id=public.current_company_id() AND public.company_module_access(company_id,'estimates'));
CREATE POLICY "survey delete" ON public.site_surveys FOR DELETE TO authenticated
 USING (company_id=public.current_company_id() AND (public.is_company_manager() OR (created_by=auth.uid() AND status='draft')));

CREATE OR REPLACE FUNCTION public.guard_site_survey() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; office boolean;
BEGIN
 NEW.updated_at := now();
 office := public.is_company_manager() OR NEW.reviewer_id = auth.uid();
 IF TG_OP='UPDATE' THEN
  NEW.company_id := OLD.company_id; NEW.created_by := OLD.created_by;
  IF NOT office AND NEW.status NOT IN ('draft','submitted') THEN RAISE EXCEPTION 'Only the reviewer can progress a survey'; END IF;
  IF NOT office AND (NEW.pricing IS DISTINCT FROM OLD.pricing OR NEW.zoho_sync IS DISTINCT FROM OLD.zoho_sync) THEN RAISE EXCEPTION 'Pricing is office-only'; END IF;
  IF OLD.status <> 'draft' AND NOT office THEN RAISE EXCEPTION 'Submitted surveys are locked'; END IF;
 ELSE
  IF NEW.status NOT IN ('draft','submitted') THEN NEW.status := 'draft'; END IF;
  IF NOT public.is_company_manager() THEN NEW.pricing := '{}'; NEW.zoho_sync := NULL; END IF;
 END IF;
 IF NEW.status='submitted' AND (TG_OP='INSERT' OR OLD.status='draft') THEN
  NEW.submitted_at := now();
  IF NEW.reviewer_id IS NULL THEN
   SELECT survey_reviewer_mode, survey_reviewer_user_id INTO s FROM public.company_settings WHERE company_id=NEW.company_id;
   IF s.survey_reviewer_mode='user' AND public.member_is_active(s.survey_reviewer_user_id) THEN NEW.reviewer_id := s.survey_reviewer_user_id; END IF;
  END IF;
 END IF;
 IF NEW.zoho_sync IS NULL THEN
  SELECT CASE WHEN NEW.track='direct' THEN zoho_sync_direct ELSE zoho_sync_supplier END INTO NEW.zoho_sync FROM public.company_settings WHERE company_id=NEW.company_id;
 END IF;
 IF NEW.status IN ('priced','converted','rejected') AND NEW.reviewed_at IS NULL THEN NEW.reviewed_at := now(); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER site_surveys_guard BEFORE INSERT OR UPDATE ON public.site_surveys FOR EACH ROW EXECUTE FUNCTION public.guard_site_survey();