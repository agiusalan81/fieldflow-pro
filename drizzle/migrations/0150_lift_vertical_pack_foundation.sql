-- Lift & Escalator vertical pack foundation: technical passports, site surveys, costing sheets, maintenance logs.
-- All tenant-only (no anon/portal access), company-scoped RLS, writes guarded by the lift_pack module.

-- 1. Equipment technical passport (1:1 with a core asset). equipment_type decides which spec blocks apply.
CREATE TABLE public.lift_passports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  equipment_type text NOT NULL DEFAULT 'lift' CHECK (equipment_type IN ('lift','escalator','moving_walk')),
  drive_type text NOT NULL DEFAULT '' CHECK (drive_type IN ('','traction','hydraulic','screw','na')),
  -- Auto-suggesting engineering detail blocks; every field supports 'N/A' and custom entries.
  general jsonb NOT NULL DEFAULT '{}'::jsonb,
  machine_drive jsonb NOT NULL DEFAULT '{}'::jsonb,
  suspension_safety jsonb NOT NULL DEFAULT '{}'::jsonb,
  controller_electronics jsonb NOT NULL DEFAULT '{}'::jsonb,
  doors_cabin jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalator_geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalator_steps_chains jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalator_handrail_balustrade jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lift_passports TO authenticated;
GRANT ALL ON public.lift_passports TO service_role;
ALTER TABLE public.lift_passports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read company passports" ON public.lift_passports FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY "Managers manage company passports" ON public.lift_passports FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE INDEX lift_passports_company ON public.lift_passports(company_id);
DROP TRIGGER IF EXISTS lift_passports_vertical_guard ON public.lift_passports;
CREATE TRIGGER lift_passports_vertical_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lift_passports
  FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('lift_pack');

-- 2. Site measure & shaft survey (lifts and escalators). Feeds supplier RFQs and costing sheets.
CREATE TABLE public.lift_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  survey_number text NOT NULL DEFAULT '',
  survey_kind text NOT NULL DEFAULT 'lift' CHECK (survey_kind IN ('lift','escalator','moving_walk')),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'new_installation' CHECK (purpose IN ('new_installation','modernisation','replacement','assessment')),
  is_bare_shaft boolean NOT NULL DEFAULT true,
  requires_dismantling boolean NOT NULL DEFAULT false,
  dismantling_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  floor_heights jsonb NOT NULL DEFAULT '[]'::jsonb,
  power_supply jsonb NOT NULL DEFAULT '{}'::jsonb,
  modernisation_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  logistics jsonb NOT NULL DEFAULT '{}'::jsonb,
  sketch text,
  photos text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalised','rfq_sent','quoted','converted','archived')),
  conducted_by uuid DEFAULT auth.uid(),
  conducted_at date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lift_surveys TO authenticated;
GRANT ALL ON public.lift_surveys TO service_role;
ALTER TABLE public.lift_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read company surveys" ON public.lift_surveys FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY "Managers manage company surveys" ON public.lift_surveys FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE INDEX lift_surveys_company_status ON public.lift_surveys(company_id, status);
CREATE INDEX lift_surveys_site ON public.lift_surveys(site_id);
DROP TRIGGER IF EXISTS lift_surveys_vertical_guard ON public.lift_surveys;
CREATE TRIGGER lift_surveys_vertical_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lift_surveys
  FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('lift_pack');

-- 3. Internal costing sheet: supplier cost + wages + markups -> client price. Tenant-only, never client-visible.
CREATE TABLE public.lift_costing_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  survey_id uuid REFERENCES public.lift_surveys(id) ON DELETE SET NULL,
  rfq_id uuid REFERENCES public.lift_estimates(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.customer_quotes(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  equipment_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (equipment_cost >= 0),
  freight_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (freight_cost >= 0),
  customs_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (customs_cost >= 0),
  dismantling_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (dismantling_cost >= 0),
  third_party_costs jsonb NOT NULL DEFAULT '[]'::jsonb,
  mechanical_hours numeric(8,2) NOT NULL DEFAULT 0 CHECK (mechanical_hours >= 0),
  mechanical_rate numeric(8,2) NOT NULL DEFAULT 0 CHECK (mechanical_rate >= 0),
  electrical_hours numeric(8,2) NOT NULL DEFAULT 0 CHECK (electrical_hours >= 0),
  electrical_rate numeric(8,2) NOT NULL DEFAULT 0 CHECK (electrical_rate >= 0),
  certification_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (certification_cost >= 0),
  equipment_markup_pct numeric(5,2) NOT NULL DEFAULT 0,
  labour_markup_pct numeric(5,2) NOT NULL DEFAULT 0,
  subcontractor_markup_pct numeric(5,2) NOT NULL DEFAULT 0,
  contingency_pct numeric(5,2) NOT NULL DEFAULT 0,
  comparison_scenarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  stage_payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  client_price numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','priced','pushed_to_quote','archived')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lift_costing_sheets TO authenticated;
GRANT ALL ON public.lift_costing_sheets TO service_role;
ALTER TABLE public.lift_costing_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage company costing" ON public.lift_costing_sheets FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE INDEX lift_costing_sheets_company ON public.lift_costing_sheets(company_id, status);
DROP TRIGGER IF EXISTS lift_costing_sheets_vertical_guard ON public.lift_costing_sheets;
CREATE TRIGGER lift_costing_sheets_vertical_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lift_costing_sheets
  FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('lift_pack');

-- 4. Field maintenance protocol log (1:1 with a completed job sheet). EN 81-20 / EN 115 tolerances live in checklist_data.
CREATE TABLE public.lift_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  job_sheet_id uuid NOT NULL REFERENCES public.job_sheets(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  protocol_type text NOT NULL DEFAULT 'lift' CHECK (protocol_type IN ('lift','escalator','moving_walk')),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','quarterly','annual','audit')),
  checklist_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  measurements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ard_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  defects jsonb NOT NULL DEFAULT '[]'::jsonb,
  out_of_service boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_sheet_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lift_maintenance_logs TO authenticated;
GRANT ALL ON public.lift_maintenance_logs TO service_role;
ALTER TABLE public.lift_maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read company maintenance logs" ON public.lift_maintenance_logs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY "Members insert own maintenance logs" ON public.lift_maintenance_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY "Managers manage company maintenance logs" ON public.lift_maintenance_logs FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Managers delete company maintenance logs" ON public.lift_maintenance_logs FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager());
CREATE INDEX lift_maintenance_logs_company ON public.lift_maintenance_logs(company_id);
CREATE INDEX lift_maintenance_logs_asset ON public.lift_maintenance_logs(asset_id);
DROP TRIGGER IF EXISTS lift_maintenance_logs_vertical_guard ON public.lift_maintenance_logs;
CREATE TRIGGER lift_maintenance_logs_vertical_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lift_maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('lift_pack');