ALTER TABLE public.site_surveys ADD COLUMN field_details jsonb NOT NULL DEFAULT '{}', ADD COLUMN trade_review jsonb NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.site_surveys.field_details IS 'Survey-scoped prospect/location/contact snapshots, selected trades and room observations; does not create client records or register trades.';
COMMENT ON COLUMN public.site_surveys.trade_review IS 'Manager-only per-trade handling decisions; does not automatically dispatch, send RFQs or export quotes.';
CREATE OR REPLACE FUNCTION public.guard_site_survey()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s record; office boolean; field_actor boolean; chosen uuid;
BEGIN
 NEW.updated_at := now();
 office := public.is_company_manager();
 field_actor := NOT office;
 IF NOT public.member_is_active(auth.uid()) OR NEW.company_id IS DISTINCT FROM public.current_company_id() THEN RAISE EXCEPTION 'Survey access unavailable'; END IF;
 IF TG_OP='UPDATE' THEN
  NEW.company_id := OLD.company_id; NEW.created_by := OLD.created_by;
  IF NOT office AND NEW.status NOT IN ('draft','submitted') THEN RAISE EXCEPTION 'Only a manager can progress a survey'; END IF;
  IF NOT office AND (NEW.pricing IS DISTINCT FROM OLD.pricing OR NEW.zoho_sync IS DISTINCT FROM OLD.zoho_sync OR NEW.trade_review IS DISTINCT FROM OLD.trade_review OR NEW.track IS DISTINCT FROM OLD.track) THEN RAISE EXCEPTION 'Commercial review is manager-only'; END IF;
  IF OLD.status <> 'draft' AND NOT office THEN RAISE EXCEPTION 'Submitted surveys are locked'; END IF;
 ELSE
  IF NEW.status NOT IN ('draft','submitted') THEN NEW.status := 'draft'; END IF;
  IF NOT office THEN NEW.pricing := '{}'; NEW.zoho_sync := NULL; NEW.trade_review := '{}'; NEW.track := 'direct'; END IF;
 END IF;
 IF jsonb_typeof(NEW.field_details) <> 'object' OR jsonb_typeof(NEW.trade_review) <> 'object' THEN RAISE EXCEPTION 'Invalid survey details'; END IF;
 IF NEW.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=NEW.client_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Client is not available'; END IF;
 IF NEW.site_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sites WHERE id=NEW.site_id AND company_id=NEW.company_id AND client_id=NEW.client_id) THEN RAISE EXCEPTION 'Site does not belong to this client'; END IF;
 IF NEW.reviewer_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id OR NEW.status='submitted') THEN
  IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.reviewer_id AND company_id=NEW.company_id AND registration_status='active' AND (CASE WHEN field_actor THEN role='supervisor' ELSE role IN ('supervisor','admin','superuser') END)) THEN RAISE EXCEPTION 'Choose an active survey reviewer'; END IF;
 END IF;
 IF NEW.status='submitted' AND (TG_OP='INSERT' OR OLD.status='draft') THEN
  NEW.submitted_at := now();
  IF NEW.reviewer_id IS NULL THEN
   SELECT survey_reviewer_mode,survey_reviewer_user_id INTO s FROM public.company_settings WHERE company_id=NEW.company_id;
   IF s.survey_reviewer_mode='user' AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=s.survey_reviewer_user_id AND company_id=NEW.company_id AND registration_status='active' AND (CASE WHEN field_actor THEN role='supervisor' ELSE role IN ('supervisor','admin','superuser') END)) THEN NEW.reviewer_id := s.survey_reviewer_user_id;
   ELSIF field_actor THEN
    SELECT user_id INTO chosen FROM public.user_roles WHERE company_id=NEW.company_id AND registration_status='active' AND role='supervisor' ORDER BY user_id LIMIT 1;
    IF (SELECT count(*) FROM public.user_roles WHERE company_id=NEW.company_id AND registration_status='active' AND role='supervisor')=1 THEN NEW.reviewer_id := chosen; END IF;
   END IF;
  END IF;
  IF field_actor AND NEW.reviewer_id IS NULL THEN RAISE EXCEPTION 'Select your supervisor'; END IF;
 END IF;
 IF NEW.zoho_sync IS NULL THEN
  SELECT CASE WHEN NEW.track='direct' THEN zoho_sync_direct ELSE zoho_sync_supplier END INTO NEW.zoho_sync FROM public.company_settings WHERE company_id=NEW.company_id;
 END IF;
 IF NEW.status IN ('priced','converted','rejected') AND NEW.reviewed_at IS NULL THEN NEW.reviewed_at := now(); END IF;
 RETURN NEW;
END $function$;