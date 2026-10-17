ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS logo_data text;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['assets','checklist_templates','client_contacts','clients','daily_work_reports','internal_work_logs','inventory_items','job_sheets','jobs','jobsheet_parts','jobsheet_time_logs','leave_requests','lift_estimates','maintenance_agreements','overtime_logs','shifts','sites','standby_swaps'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Superuser delete any" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Superuser delete any" ON public.%I FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), ''superuser''))', t);
    EXECUTE format('GRANT DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;