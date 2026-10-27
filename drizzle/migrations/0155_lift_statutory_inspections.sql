CREATE TABLE public.lift_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  inspection_type text NOT NULL DEFAULT 'periodic',
  inspection_body text NOT NULL DEFAULT '',
  inspector_name text NOT NULL DEFAULT '',
  certificate_no text NOT NULL DEFAULT '',
  inspected_on date NOT NULL DEFAULT current_date,
  next_due date,
  result text NOT NULL DEFAULT 'pass' CHECK (result IN ('pass','pass_with_defects','fail')),
  defects text NOT NULL DEFAULT '',
  defects_closed boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lift_inspections TO authenticated;
GRANT ALL ON public.lift_inspections TO service_role;
ALTER TABLE public.lift_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read company inspections" ON public.lift_inspections FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY "Managers manage company inspections" ON public.lift_inspections FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager() AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND a.company_id = public.current_company_id()));
CREATE INDEX lift_inspections_company_due ON public.lift_inspections(company_id, next_due);
CREATE INDEX lift_inspections_asset ON public.lift_inspections(asset_id, inspected_on DESC);
CREATE TRIGGER lift_inspections_vertical_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lift_inspections
  FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('lift_pack');