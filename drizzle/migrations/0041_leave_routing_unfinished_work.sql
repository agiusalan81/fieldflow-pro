ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS handover_note text, ADD COLUMN IF NOT EXISTS handover_action text, ADD COLUMN IF NOT EXISTS handover_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_leave_decision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE office boolean := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') AND auth.uid() IS NOT NULL THEN
    IF NEW.user_id = auth.uid() AND NOT public.has_role(auth.uid(),'superuser') THEN
      RAISE EXCEPTION 'You cannot decide on your own leave request';
    END IF;
    IF NOT office AND NOT public.has_role(NEW.user_id,'technician') THEN
      RAISE EXCEPTION 'Only an Office Admin can decide on this leave request';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_leave_decision ON public.leave_requests;
CREATE TRIGGER guard_leave_decision BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.guard_leave_decision();