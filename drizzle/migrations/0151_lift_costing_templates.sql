CREATE TABLE public.lift_costing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  equipment_type text NOT NULL DEFAULT 'passenger_lift',
  supplier_origin text NOT NULL DEFAULT '',
  output_style text NOT NULL DEFAULT 'itemised' CHECK (output_style IN ('turnkey','itemised','net_vat_shipping')),
  turnkey_description text NOT NULL DEFAULT '',
  spec_groups text[] NOT NULL DEFAULT '{}',
  custom_specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  inclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lift_costing_templates TO authenticated;
GRANT ALL ON public.lift_costing_templates TO service_role;
ALTER TABLE public.lift_costing_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage company costing templates" ON public.lift_costing_templates FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE INDEX lift_costing_templates_company ON public.lift_costing_templates(company_id);
CREATE TRIGGER lift_costing_templates_vertical_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lift_costing_templates
  FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('lift_pack');

ALTER TABLE public.lift_costing_sheets
  ADD COLUMN template_id uuid REFERENCES public.lift_costing_templates(id) ON DELETE SET NULL,
  ADD COLUMN equipment_type text NOT NULL DEFAULT 'passenger_lift',
  ADD COLUMN output_style text NOT NULL DEFAULT 'itemised' CHECK (output_style IN ('turnkey','itemised','net_vat_shipping')),
  ADD COLUMN turnkey_description text NOT NULL DEFAULT '',
  ADD COLUMN spec_groups text[] NOT NULL DEFAULT '{}',
  ADD COLUMN specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN custom_specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN inclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN notes text NOT NULL DEFAULT '',
  ADD COLUMN vat_pct numeric NOT NULL DEFAULT 18 CHECK (vat_pct >= 0 AND vat_pct <= 100);

CREATE OR REPLACE FUNCTION public.guard_costing_template_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.template_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.lift_costing_templates t WHERE t.id = NEW.template_id AND t.company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Costing template belongs to another company';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lift_costing_sheets_template_scope BEFORE INSERT OR UPDATE OF template_id ON public.lift_costing_sheets
  FOR EACH ROW EXECUTE FUNCTION public.guard_costing_template_scope();