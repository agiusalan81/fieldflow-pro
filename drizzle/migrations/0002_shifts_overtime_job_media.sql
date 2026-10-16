CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shift_type text NOT NULL DEFAULT 'shift' CHECK (shift_type IN ('shift','travel')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or manager" ON public.shifts FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_manager()));
CREATE POLICY "Insert own" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());
CREATE POLICY "Update own" ON public.shifts FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());
CREATE POLICY "Manager delete" ON public.shifts FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager());

CREATE TABLE public.overtime_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_sheet_id uuid REFERENCES public.job_sheets(id) ON DELETE SET NULL,
  log_date date NOT NULL DEFAULT current_date,
  call_type text NOT NULL CHECK (call_type IN ('weekend','after_hours','standby','public_holiday')),
  travel_hours numeric NOT NULL DEFAULT 0 CHECK (travel_hours >= 0),
  work_hours numeric NOT NULL DEFAULT 0 CHECK (work_hours >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_logs TO authenticated;
GRANT ALL ON public.overtime_logs TO service_role;
ALTER TABLE public.overtime_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or manager" ON public.overtime_logs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_manager()));
CREATE POLICY "Insert own" ON public.overtime_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());
CREATE POLICY "Own or manager delete" ON public.overtime_logs FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_manager()));

ALTER TABLE public.job_sheets ADD COLUMN photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.job_sheets ADD COLUMN signature_data text;

CREATE POLICY "Company read job photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = public.current_company_id()::text);
CREATE POLICY "Company upload job photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = public.current_company_id()::text);
CREATE POLICY "Company delete job photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = public.current_company_id()::text);