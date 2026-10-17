ALTER TABLE public.client_contacts ADD COLUMN IF NOT EXISTS has_whatsapp boolean NOT NULL DEFAULT false;
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS office_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.close_pending_on_followup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.job_id IS NOT NULL AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.job_sheets SET pending_status = 'done'
    WHERE pending_job_id = NEW.job_id AND company_id = NEW.company_id AND pending_status <> 'done';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_close_pending_on_followup ON public.job_sheets;
CREATE TRIGGER trg_close_pending_on_followup AFTER UPDATE OF status ON public.job_sheets
FOR EACH ROW EXECUTE FUNCTION public.close_pending_on_followup();