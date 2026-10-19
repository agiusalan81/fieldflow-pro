ALTER TABLE public.lift_estimates
  ADD COLUMN IF NOT EXISTS rfq jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sketch text,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminders_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminders_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS estimate_config jsonb NOT NULL DEFAULT '{}'::jsonb;
DROP TRIGGER IF EXISTS lift_estimates_module_guard ON public.lift_estimates;
CREATE TRIGGER lift_estimates_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lift_estimates
  FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('estimates');