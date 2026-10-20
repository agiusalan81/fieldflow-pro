ALTER TABLE public.jobs ADD COLUMN secondary_technician_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX jobs_secondary_technician_idx ON public.jobs(secondary_technician_id, scheduled_date);
CREATE OR REPLACE FUNCTION public.guard_job_staffing() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.secondary_technician_id IS NOT NULL AND (NEW.assigned_technician_id IS NULL OR NEW.secondary_technician_id=NEW.assigned_technician_id) THEN RAISE EXCEPTION 'Choose a different assisting technician and a lead'; END IF;
 IF NEW.secondary_technician_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=NEW.secondary_technician_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Assisting technician must belong to this company'; END IF;
 IF NEW.assigned_technician_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=NEW.assigned_technician_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Lead must belong to this company'; END IF;
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND NOT public.is_company_manager() AND NEW.secondary_technician_id IS DISTINCT FROM OLD.secondary_technician_id THEN RAISE EXCEPTION 'Only dispatch can change assisting staff'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER jobs_staffing_guard BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_job_staffing();
ALTER POLICY "Manager or assignee read" ON public.jobs USING(company_id=public.current_company_id() AND (public.is_company_manager() OR assigned_technician_id=auth.uid() OR secondary_technician_id=auth.uid()));
ALTER TABLE public.daily_work_reports ADD COLUMN superseded_by uuid REFERENCES public.daily_work_reports(id), ADD COLUMN correction_original jsonb;
WITH ranked AS (SELECT id,first_value(id) OVER(PARTITION BY shift_id ORDER BY created_at,id) keeper,row_number() OVER(PARTITION BY shift_id ORDER BY created_at,id) n FROM public.daily_work_reports WHERE shift_id IS NOT NULL) UPDATE public.daily_work_reports d SET superseded_by=r.keeper FROM ranked r WHERE d.id=r.id AND r.n>1;
CREATE UNIQUE INDEX daily_work_reports_one_per_shift ON public.daily_work_reports(shift_id) WHERE shift_id IS NOT NULL AND superseded_by IS NULL;
CREATE POLICY canonical_report_boundary ON public.daily_work_reports AS RESTRICTIVE FOR SELECT TO authenticated USING(superseded_by IS NULL);
CREATE OR REPLACE FUNCTION public.guard_report_shift() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.shift_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.shifts WHERE id=NEW.shift_id AND user_id=NEW.user_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Report must match its own company shift'; END IF;
 IF auth.uid() IS NOT NULL AND (NEW.superseded_by IS NOT NULL OR NEW.correction_original IS NOT NULL) THEN RAISE EXCEPTION 'Report audit fields are protected'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER daily_report_shift_guard BEFORE INSERT ON public.daily_work_reports FOR EACH ROW EXECUTE FUNCTION public.guard_report_shift();