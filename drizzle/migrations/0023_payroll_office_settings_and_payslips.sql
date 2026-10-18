CREATE TABLE public.payroll_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), effective_from date NOT NULL DEFAULT CURRENT_DATE,
 standby_weekly_eur numeric NOT NULL DEFAULT 50 CHECK (standby_weekly_eur >= 0), sick_full_hours numeric NOT NULL DEFAULT 0 CHECK (sick_full_hours >= 0), sick_half_hours numeric NOT NULL DEFAULT 0 CHECK (sick_half_hours >= 0), country text NOT NULL DEFAULT 'Malta', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,effective_from)
);
GRANT SELECT, INSERT, UPDATE ON public.payroll_policies TO authenticated;
GRANT ALL ON public.payroll_policies TO service_role;
ALTER TABLE public.payroll_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_policies_office ON public.payroll_policies FOR ALL TO authenticated USING (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'))) WITH CHECK (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')));
CREATE TABLE public.employee_payroll_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), user_id uuid NOT NULL REFERENCES public.users(id), entitlement_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE) CHECK(entitlement_year BETWEEN 2000 AND 2200), hourly_rate numeric NOT NULL DEFAULT 0 CHECK(hourly_rate >= 0), sick_full_hours numeric NOT NULL DEFAULT 0 CHECK(sick_full_hours >= 0), sick_half_hours numeric NOT NULL DEFAULT 0 CHECK(sick_half_hours >= 0), tax_reference text, notes text, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,user_id,entitlement_year)
);
GRANT SELECT, INSERT, UPDATE ON public.employee_payroll_settings TO authenticated;
GRANT ALL ON public.employee_payroll_settings TO service_role;
ALTER TABLE public.employee_payroll_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_payroll_office ON public.employee_payroll_settings FOR ALL TO authenticated USING (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'))) WITH CHECK (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id=user_id AND u.company_id=public.current_company_id()));
CREATE TABLE public.payroll_roster_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), effective_from date NOT NULL, roster_start date NOT NULL, rotation_days integer NOT NULL, per_shift integer NOT NULL, technician_order uuid[] NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,effective_from)
);
GRANT SELECT ON public.payroll_roster_versions TO authenticated;
GRANT ALL ON public.payroll_roster_versions TO service_role;
ALTER TABLE public.payroll_roster_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_rosters_office ON public.payroll_roster_versions FOR SELECT TO authenticated USING (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')));
INSERT INTO public.payroll_roster_versions(company_id,effective_from,roster_start,rotation_days,per_shift,technician_order) SELECT company_id,standby_start,standby_start,standby_rotation_days,standby_per_shift,standby_order FROM public.company_settings;
CREATE OR REPLACE FUNCTION public.capture_payroll_roster() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' OR NEW.standby_start IS DISTINCT FROM OLD.standby_start OR NEW.standby_rotation_days IS DISTINCT FROM OLD.standby_rotation_days OR NEW.standby_per_shift IS DISTINCT FROM OLD.standby_per_shift OR NEW.standby_order IS DISTINCT FROM OLD.standby_order THEN
 INSERT INTO public.payroll_roster_versions(company_id,effective_from,roster_start,rotation_days,per_shift,technician_order) VALUES(NEW.company_id,CURRENT_DATE,NEW.standby_start,NEW.standby_rotation_days,NEW.standby_per_shift,NEW.standby_order) ON CONFLICT(company_id,effective_from) DO UPDATE SET roster_start=EXCLUDED.roster_start,rotation_days=EXCLUDED.rotation_days,per_shift=EXCLUDED.per_shift,technician_order=EXCLUDED.technician_order,captured_at=now();
 END IF; RETURN NEW; END $$;
CREATE TRIGGER company_settings_payroll_roster AFTER INSERT OR UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.capture_payroll_roster();
CREATE TABLE public.payroll_payslips (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), user_id uuid NOT NULL REFERENCES public.users(id), period_start date NOT NULL, period_end date NOT NULL CHECK(period_end >= period_start), snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, gross_eur numeric NOT NULL DEFAULT 0 CHECK(gross_eur >= 0), net_eur numeric NOT NULL DEFAULT 0 CHECK(net_eur >= 0), created_by uuid NOT NULL DEFAULT auth.uid(), issued_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,user_id,period_start,period_end)
);
GRANT SELECT, INSERT ON public.payroll_payslips TO authenticated;
GRANT ALL ON public.payroll_payslips TO service_role;
ALTER TABLE public.payroll_payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_payslip_read ON public.payroll_payslips FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')));
CREATE POLICY payroll_payslip_issue ON public.payroll_payslips FOR INSERT TO authenticated WITH CHECK (company_id=public.current_company_id() AND created_by=auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=user_id AND u.company_id=public.current_company_id()));
CREATE INDEX payroll_payslips_period ON public.payroll_payslips(company_id,period_start,period_end);
COMMENT ON TABLE public.payroll_payslips IS 'Immutable office-reviewed payroll snapshots; statutory tax and NI are manually reviewed amounts, not an automated Malta tax engine.';
COMMENT ON TABLE public.payroll_roster_versions IS 'Roster changes effective on save day; initial history reflects the roster known when payroll was introduced.';