ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS integrations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_rates jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS labor_rates jsonb;
ALTER TABLE public.lift_estimates
  ADD COLUMN IF NOT EXISTS client_price numeric,
  ADD COLUMN IF NOT EXISTS fixed_labor boolean NOT NULL DEFAULT true;
ALTER TABLE public.job_sheets
  ADD COLUMN IF NOT EXISTS estimate_id uuid REFERENCES public.lift_estimates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS billing_source text,
  ADD COLUMN IF NOT EXISTS billing_data jsonb,
  ADD COLUMN IF NOT EXISTS billing_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS billing_reviewed_at timestamptz;
ALTER TABLE public.job_sheets ADD CONSTRAINT job_sheets_billing_status_chk CHECK (billing_status IN ('unreviewed','approved','exported'));

CREATE OR REPLACE FUNCTION public.guard_billing_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_company_role('admin') AND (
    NEW.billing_status IS DISTINCT FROM OLD.billing_status OR NEW.billing_data IS DISTINCT FROM OLD.billing_data
    OR NEW.billing_source IS DISTINCT FROM OLD.billing_source OR NEW.billing_reviewed_by IS DISTINCT FROM OLD.billing_reviewed_by
    OR NEW.billing_reviewed_at IS DISTINCT FROM OLD.billing_reviewed_at) THEN
    RAISE EXCEPTION 'Only office admins can review billing';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER job_sheets_guard_billing BEFORE UPDATE ON public.job_sheets FOR EACH ROW EXECUTE FUNCTION public.guard_billing_review();