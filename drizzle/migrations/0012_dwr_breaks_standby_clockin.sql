ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS break_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS breaks_per_shift integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS standby_rotation_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS standby_per_shift integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS standby_start date NOT NULL DEFAULT date_trunc('week', now())::date,
  ADD COLUMN IF NOT EXISTS standby_order uuid[] NOT NULL DEFAULT '{}';

CREATE TABLE public.internal_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  activity text NOT NULL,
  location text,
  time_in time NOT NULL,
  time_out time NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_work_logs TO authenticated;
GRANT ALL ON public.internal_work_logs TO service_role;
ALTER TABLE public.internal_work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or managed internal work" ON public.internal_work_logs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_manager()));
CREATE POLICY "Add own internal work" ON public.internal_work_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());
CREATE POLICY "Edit own internal work" ON public.internal_work_logs FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid());
CREATE POLICY "Delete own internal work" ON public.internal_work_logs FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid());

CREATE TABLE public.daily_work_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  report_date date NOT NULL,
  shift_start timestamptz NOT NULL,
  shift_end timestamptz NOT NULL,
  rows jsonb NOT NULL DEFAULT '[]',
  break_minutes integer NOT NULL DEFAULT 0,
  worked_hours numeric NOT NULL DEFAULT 0,
  standard_hours numeric NOT NULL DEFAULT 0,
  ot15_hours numeric NOT NULL DEFAULT 0,
  ot20_hours numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX daily_work_reports_company_date ON public.daily_work_reports(company_id, report_date);
GRANT SELECT, INSERT ON public.daily_work_reports TO authenticated;
GRANT ALL ON public.daily_work_reports TO service_role;
ALTER TABLE public.daily_work_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or all reports as manager" ON public.daily_work_reports FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_manager()));
CREATE POLICY "File own report" ON public.daily_work_reports FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());

CREATE TABLE public.standby_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  swap_date date NOT NULL,
  requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.standby_swaps TO authenticated;
GRANT ALL ON public.standby_swaps TO service_role;
ALTER TABLE public.standby_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company reads swaps" ON public.standby_swaps FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "Request own swap" ON public.standby_swaps FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND requester_id = auth.uid() AND target_id <> auth.uid() AND status = 'pending');
CREATE POLICY "Target, requester or manager answers" ON public.standby_swaps FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (target_id = auth.uid() OR requester_id = auth.uid() OR public.is_company_manager()));

CREATE OR REPLACE FUNCTION public.guard_standby_swap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','accepted','declined','cancelled') THEN RAISE EXCEPTION 'Invalid swap status'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_company_manager() THEN
    IF NEW.status IN ('accepted','declined') AND auth.uid() <> OLD.target_id THEN RAISE EXCEPTION 'Only the colleague asked can accept or decline'; END IF;
    IF NEW.status = 'cancelled' AND auth.uid() <> OLD.requester_id THEN RAISE EXCEPTION 'Only the requester can cancel'; END IF;
    IF NEW.swap_date <> OLD.swap_date OR NEW.requester_id <> OLD.requester_id OR NEW.target_id <> OLD.target_id THEN RAISE EXCEPTION 'Swap details cannot change'; END IF;
  END IF;
  IF NEW.status <> OLD.status THEN NEW.responded_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER standby_swaps_guard BEFORE UPDATE ON public.standby_swaps FOR EACH ROW EXECUTE FUNCTION public.guard_standby_swap();

CREATE OR REPLACE FUNCTION public.require_clock_in_for_sheet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.shifts WHERE user_id = auth.uid() AND shift_type = 'shift' AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Clock in before starting a job sheet';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER job_sheets_require_clock_in BEFORE INSERT ON public.job_sheets FOR EACH ROW EXECUTE FUNCTION public.require_clock_in_for_sheet();

-- Job-sheet time a user worked on a date: as the sheet's technician, or as an assisting technician via initials.
CREATE OR REPLACE FUNCTION public.dwr_sheet_entries(_user uuid, _date date)
RETURNS TABLE(jobsheet_id uuid, jobsheet_number text, client text, site text, time_in time, time_out time, travel numeric, lead_name text, assisting boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.jobsheet_number, c.name, coalesce(si.name, si.address), l.time_in, l.time_out, l.traveling_time_hours,
         lu.full_name, (s.assigned_technician_id IS DISTINCT FROM _user)
  FROM public.jobsheet_time_logs l
  JOIN public.job_sheets s ON s.id = l.jobsheet_id
  JOIN public.users u ON u.id = _user AND u.company_id = s.company_id
  LEFT JOIN public.clients c ON c.id = s.client_id
  LEFT JOIN public.sites si ON si.id = s.site_id
  LEFT JOIN public.users lu ON lu.id = s.assigned_technician_id
  WHERE l.log_date = _date
    AND s.company_id = public.current_company_id()
    AND (_user = auth.uid() OR public.is_company_manager())
    AND (s.assigned_technician_id = _user
         OR (coalesce(u.technician_initials, '') <> '' AND upper(u.technician_initials) = ANY (SELECT upper(x) FROM unnest(l.technician_initials) x)))
  ORDER BY l.time_in NULLS LAST
$$;
GRANT EXECUTE ON FUNCTION public.dwr_sheet_entries(uuid, date) TO authenticated;