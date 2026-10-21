ALTER TABLE public.qs_surveys ADD COLUMN review jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN closed_by uuid, ADD COLUMN closed_at timestamptz;
ALTER TABLE public.qs_surveys DROP CONSTRAINT qs_surveys_status_check;
ALTER TABLE public.qs_surveys ADD CONSTRAINT qs_surveys_status_check CHECK (status = ANY (ARRAY['draft','submitted','signed_off','closed']));
DROP POLICY "qs surveys members update" ON public.qs_surveys;
CREATE POLICY "qs surveys members update" ON public.qs_surveys FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.member_is_active(auth.uid()) AND status <> 'closed' AND (status <> 'signed_off' OR public.is_company_manager()))
  WITH CHECK (company_id = public.current_company_id() AND public.company_module_access(company_id, 'qs_pricing'));
CREATE OR REPLACE FUNCTION public.qs_surveys_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status = 'closed' THEN RAISE EXCEPTION 'Closed survey is locked'; END IF;
  NEW.company_id := OLD.company_id; NEW.created_by := OLD.created_by;
  IF OLD.status = 'signed_off' THEN
    IF NOT public.is_company_manager() THEN RAISE EXCEPTION 'Only supervisors or office can review variances'; END IF;
    IF NEW.status NOT IN ('signed_off','closed') THEN RAISE EXCEPTION 'Signed-off quantities are locked'; END IF;
    -- signed field record stays immutable; only the commercial review may change
    NEW.lines := OLD.lines; NEW.title := OLD.title; NEW.site_label := OLD.site_label; NEW.notes := OLD.notes;
    NEW.trade := OLD.trade; NEW.proposal_id := OLD.proposal_id;
    NEW.submitted_at := OLD.submitted_at; NEW.signed_off_by := OLD.signed_off_by; NEW.signed_off_at := OLD.signed_off_at;
    IF NEW.status = 'closed' THEN NEW.closed_by := auth.uid(); NEW.closed_at := now(); ELSE NEW.closed_by := NULL; NEW.closed_at := NULL; END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF NEW.status = 'closed' THEN RAISE EXCEPTION 'Sign off the survey before closing'; END IF;
  NEW.review := OLD.review; NEW.closed_by := NULL; NEW.closed_at := NULL;
  IF NEW.status = 'signed_off' THEN
    IF NOT public.is_company_manager() THEN RAISE EXCEPTION 'Only supervisors or office can sign off'; END IF;
    IF OLD.status <> 'submitted' THEN RAISE EXCEPTION 'Submit the survey before sign-off'; END IF;
    NEW.signed_off_by := auth.uid(); NEW.signed_off_at := now();
  ELSE
    NEW.signed_off_by := NULL; NEW.signed_off_at := NULL;
  END IF;
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN NEW.submitted_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;