ALTER TABLE public.job_sheets
  ADD COLUMN IF NOT EXISTS visit_outcome text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS departure_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS departure_note text,
  ADD COLUMN IF NOT EXISTS departure_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS departure_decided_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS departure_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_notices jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.guard_departure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.departure_status NOT IN ('none','requested','approved','rejected') THEN RAISE EXCEPTION 'Invalid departure status'; END IF;
  IF NEW.visit_outcome NOT IN ('normal','no_access') THEN RAISE EXCEPTION 'Invalid visit outcome'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_company_manager() AND (
       (NEW.departure_status IS DISTINCT FROM OLD.departure_status AND NEW.departure_status IN ('approved','rejected'))
    OR NEW.departure_decided_by IS DISTINCT FROM OLD.departure_decided_by
    OR NEW.departure_decided_at IS DISTINCT FROM OLD.departure_decided_at) THEN
    RAISE EXCEPTION 'Only a supervisor or office admin can approve leaving an unsigned site';
  END IF;
  IF NEW.departure_status = 'requested' AND OLD.departure_status IS DISTINCT FROM 'requested' THEN NEW.departure_requested_at := now(); END IF;
  IF NEW.departure_status IN ('approved','rejected') AND OLD.departure_status IS DISTINCT FROM NEW.departure_status THEN
    NEW.departure_decided_by := auth.uid(); NEW.departure_decided_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER job_sheets_guard_departure BEFORE UPDATE ON public.job_sheets
FOR EACH ROW EXECUTE FUNCTION public.guard_departure();