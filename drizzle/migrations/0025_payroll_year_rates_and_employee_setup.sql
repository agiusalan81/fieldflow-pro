ALTER TABLE public.employee_payroll_settings ADD COLUMN payroll_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.company_settings ADD COLUMN pe_number text;
ALTER TABLE public.daily_work_reports ADD COLUMN overtime_rules jsonb;
CREATE TABLE public.payroll_statutory_years (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES public.companies(id),
 tax_year integer NOT NULL CHECK (tax_year BETWEEN 2000 AND 2200),
 config jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,tax_year)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.payroll_statutory_years TO authenticated;
GRANT ALL ON public.payroll_statutory_years TO service_role;
ALTER TABLE public.payroll_statutory_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_statutory_office ON public.payroll_statutory_years FOR ALL TO authenticated USING (company_id=public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'))) WITH CHECK (company_id=public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')));