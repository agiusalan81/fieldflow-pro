ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'pending';

CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company read" ON public.sites FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Manager insert" ON public.sites FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Manager update" ON public.sites FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager()) WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Manager delete" ON public.sites FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

ALTER TABLE public.assets ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_number serial,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  assigned_technician_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL DEFAULT current_date,
  window_start time,
  window_end time,
  problem_summary text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT USAGE ON SEQUENCE public.jobs_job_number_seq TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager or assignee read" ON public.jobs FOR SELECT TO authenticated USING (company_id = public.current_company_id() AND (public.is_company_manager() OR assigned_technician_id = auth.uid()));
CREATE POLICY "Manager insert" ON public.jobs FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Manager or assignee update" ON public.jobs FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND (public.is_company_manager() OR assigned_technician_id = auth.uid())) WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Manager delete" ON public.jobs FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

CREATE SEQUENCE public.jobsheet_number_seq START 7598;
GRANT USAGE ON SEQUENCE public.jobsheet_number_seq TO authenticated;
ALTER TABLE public.job_sheets
  ADD COLUMN jobsheet_number text NOT NULL DEFAULT lpad(nextval('public.jobsheet_number_seq')::text, 6, '0'),
  ADD COLUMN job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  ADD COLUMN asset_type text NOT NULL DEFAULT 'Lift' CHECK (asset_type IN ('Lift','Escalator','Other')),
  ADD COLUMN asset_type_other text,
  ADD COLUMN lift_model text,
  ADD COLUMN serial_number text,
  ADD COLUMN requires_admin_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN is_tech_assistance boolean NOT NULL DEFAULT false,
  ADD COLUMN is_maintenance boolean NOT NULL DEFAULT false,
  ADD COLUMN is_installation boolean NOT NULL DEFAULT false,
  ADD COLUMN job_type_other text,
  ADD COLUMN maintenance_agreement_type text,
  ADD COLUMN reported_fault text,
  ADD COLUMN repairs_performed text,
  ADD COLUMN pending_works_future_jobs text,
  ADD COLUMN internal_comments_admin_only text,
  ADD COLUMN technician_name text,
  ADD COLUMN client_full_name text,
  ADD COLUMN client_id_card_no text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX job_sheets_jobsheet_number_key ON public.job_sheets(jobsheet_number);
COMMENT ON COLUMN public.job_sheets.signature_data IS 'Client signature (client_signature_blob) as PNG data URL';

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER job_sheets_touch BEFORE UPDATE ON public.job_sheets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Technician creates own sheet" ON public.job_sheets FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND assigned_technician_id = auth.uid());
CREATE POLICY "Technician deletes own draft" ON public.job_sheets FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND assigned_technician_id = auth.uid() AND status::text = 'draft');

CREATE TABLE public.jobsheet_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  jobsheet_id uuid NOT NULL REFERENCES public.job_sheets(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  time_in time,
  time_out time,
  latitude_in numeric, longitude_in numeric, latitude_out numeric, longitude_out numeric,
  traveling_time_hours numeric NOT NULL DEFAULT 0,
  technician_initials text[] NOT NULL DEFAULT '{}',
  daily_work_description text,
  daily_total_hours numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE public.jobsheet_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  jobsheet_id uuid NOT NULL REFERENCES public.job_sheets(id) ON DELETE CASCADE,
  part_description text NOT NULL,
  unit text,
  quantity numeric NOT NULL DEFAULT 1,
  time_acquiring_parts_hours numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobsheet_time_logs, public.jobsheet_parts TO authenticated;
GRANT ALL ON public.jobsheet_time_logs, public.jobsheet_parts TO service_role;
ALTER TABLE public.jobsheet_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobsheet_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Via visible sheet" ON public.jobsheet_time_logs FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND EXISTS (SELECT 1 FROM public.job_sheets s WHERE s.id = jobsheet_id))
  WITH CHECK (company_id = public.current_company_id() AND EXISTS (SELECT 1 FROM public.job_sheets s WHERE s.id = jobsheet_id));
CREATE POLICY "Via visible sheet" ON public.jobsheet_parts FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND EXISTS (SELECT 1 FROM public.job_sheets s WHERE s.id = jobsheet_id))
  WITH CHECK (company_id = public.current_company_id() AND EXISTS (SELECT 1 FROM public.job_sheets s WHERE s.id = jobsheet_id));

ALTER TABLE public.leave_requests
  ADD COLUMN leave_type text NOT NULL DEFAULT 'Annual' CHECK (leave_type IN ('Annual','Sick','Training','Unpaid')),
  ADD COLUMN total_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN medical_certificate_path text,
  ADD COLUMN optional_notes text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.leave_requests ADD CONSTRAINT sick_needs_certificate CHECK (leave_type <> 'Sick' OR medical_certificate_path IS NOT NULL) NOT VALID;

CREATE TABLE public.user_leave_balances (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  base_entitlement_hours numeric NOT NULL DEFAULT 192.0,
  public_holiday_credit_hours numeric NOT NULL DEFAULT 0,
  taken_hours numeric NOT NULL DEFAULT 0,
  pending_hours numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_leave_balances TO authenticated;
GRANT ALL ON public.user_leave_balances TO service_role;
ALTER TABLE public.user_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or manager" ON public.user_leave_balances FOR SELECT TO authenticated USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_manager()));
CREATE POLICY "Manager write" ON public.user_leave_balances FOR ALL TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager()) WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());

-- keep balance taken/pending in sync with leave requests (annual leave only)
CREATE OR REPLACE FUNCTION public.sync_leave_balance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := coalesce(NEW.user_id, OLD.user_id); _cid uuid := coalesce(NEW.company_id, OLD.company_id);
BEGIN
  INSERT INTO public.user_leave_balances(user_id, company_id) VALUES (_uid, _cid) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_leave_balances b SET
    taken_hours = coalesce((SELECT sum(total_hours) FROM public.leave_requests WHERE user_id = _uid AND leave_type = 'Annual' AND status = 'approved'), 0),
    pending_hours = coalesce((SELECT sum(total_hours) FROM public.leave_requests WHERE user_id = _uid AND leave_type = 'Annual' AND status = 'pending'), 0)
  WHERE b.user_id = _uid;
  RETURN NULL;
END $$;
CREATE TRIGGER leave_requests_sync_balance AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.sync_leave_balance();

ALTER TABLE public.users
  ADD COLUMN phone_number text,
  ADD COLUMN home_address text,
  ADD COLUMN next_of_kin_1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN next_of_kin_2 jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN app_theme_preference text NOT NULL DEFAULT 'light' CHECK (app_theme_preference IN ('light','dark')),
  ADD COLUMN language_preference text NOT NULL DEFAULT 'en',
  ADD COLUMN employee_id text,
  ADD COLUMN technician_initials text,
  ADD COLUMN signature_on_file text;

CREATE OR REPLACE FUNCTION public.guard_user_privileges()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_company_role('admin') AND (
       NEW.role IS DISTINCT FROM OLD.role OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.full_name IS DISTINCT FROM OLD.full_name OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.language_preference IS DISTINCT FROM OLD.language_preference OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.technician_initials IS DISTINCT FROM OLD.technician_initials OR NEW.signature_on_file IS DISTINCT FROM OLD.signature_on_file) THEN
    RAISE EXCEPTION 'Only admins can change these profile details';
  END IF;
  RETURN NEW;
END $function$;

CREATE POLICY "Company read leave certificates" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'leave-certificates' AND (storage.foldername(name))[1] = public.current_company_id()::text AND ((storage.foldername(name))[2] = auth.uid()::text OR public.is_company_manager()));
CREATE POLICY "Upload own leave certificates" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'leave-certificates' AND (storage.foldername(name))[1] = public.current_company_id()::text AND (storage.foldername(name))[2] = auth.uid()::text);