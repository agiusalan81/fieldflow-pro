ALTER TABLE public.job_sheets
  ADD COLUMN IF NOT EXISTS return_fee_waived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_fee_hours numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.guard_return_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_company_manager() AND (
       NEW.return_fee_waived IS DISTINCT FROM OLD.return_fee_waived
    OR NEW.return_fee_hours IS DISTINCT FROM OLD.return_fee_hours) THEN
    RAISE EXCEPTION 'Only a supervisor or office admin can set the return-visit fee';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS job_sheets_guard_return_fee ON public.job_sheets;
CREATE TRIGGER job_sheets_guard_return_fee BEFORE UPDATE ON public.job_sheets
FOR EACH ROW EXECUTE FUNCTION public.guard_return_fee();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='job_sheets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_sheets;
  END IF;
END $$;