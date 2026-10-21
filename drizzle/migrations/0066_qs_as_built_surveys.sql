CREATE TABLE public.qs_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  trade text NOT NULL DEFAULT 'custom',
  site_label text NOT NULL DEFAULT '',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','signed_off')),
  created_by uuid DEFAULT auth.uid(),
  submitted_at timestamptz,
  signed_off_by uuid,
  signed_off_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qs_surveys_company_updated ON public.qs_surveys(company_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qs_surveys TO authenticated;
GRANT ALL ON public.qs_surveys TO service_role;
ALTER TABLE public.qs_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qs surveys members read" ON public.qs_surveys FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY "qs surveys members insert" ON public.qs_surveys FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.member_is_active(auth.uid()) AND public.company_module_access(company_id,'qs_pricing') AND status = 'draft');
CREATE POLICY "qs surveys members update" ON public.qs_surveys FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.member_is_active(auth.uid()) AND status <> 'signed_off')
  WITH CHECK (company_id = public.current_company_id() AND public.company_module_access(company_id,'qs_pricing'));
CREATE POLICY "qs surveys managers delete" ON public.qs_surveys FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager() AND status = 'draft');

CREATE OR REPLACE FUNCTION public.qs_surveys_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'signed_off' THEN RAISE EXCEPTION 'Signed-off survey is locked'; END IF;
  NEW.company_id := OLD.company_id; NEW.created_by := OLD.created_by;
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
CREATE TRIGGER qs_surveys_guard BEFORE UPDATE ON public.qs_surveys FOR EACH ROW EXECUTE FUNCTION public.qs_surveys_guard();