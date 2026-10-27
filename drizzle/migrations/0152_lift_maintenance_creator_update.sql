CREATE POLICY "Creators update own open maintenance logs" ON public.lift_maintenance_logs FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND created_by = auth.uid() AND public.member_is_active(auth.uid())
    AND EXISTS (SELECT 1 FROM public.job_sheets s WHERE s.id = job_sheet_id AND s.status <> 'completed'))
  WITH CHECK (company_id = public.current_company_id() AND created_by = auth.uid());