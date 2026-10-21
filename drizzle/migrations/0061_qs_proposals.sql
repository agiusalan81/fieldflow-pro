CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  reference text NOT NULL DEFAULT ('P-' || to_char(now(),'YYMMDD-HH24MISS')),
  title text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  trade text NOT NULL DEFAULT 'elevator',
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposals_company_updated ON public.proposals(company_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals managers read" ON public.proposals FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()));
CREATE POLICY "proposals managers insert" ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager() AND public.company_module_access(company_id,'qs_pricing'));
CREATE POLICY "proposals managers update" ON public.proposals FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.company_module_access(company_id,'qs_pricing'));
CREATE POLICY "proposals managers delete" ON public.proposals FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager() AND status = 'draft');
CREATE TRIGGER proposals_touch BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();