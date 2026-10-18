ALTER TABLE public.user_leave_balances ADD COLUMN carried_forward_hours numeric NOT NULL DEFAULT 0 CHECK (carried_forward_hours >= 0), ADD COLUMN carried_forward_year integer;
COMMENT ON COLUMN public.user_leave_balances.carried_forward_hours IS 'Manager-entered opening carry-forward entitlement; counted only for carried_forward_year. Payslip issuance must not consume leave again.';
CREATE FUNCTION public.guard_leave_opening_balance() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (NEW.carried_forward_hours IS DISTINCT FROM OLD.carried_forward_hours OR NEW.carried_forward_year IS DISTINCT FROM OLD.carried_forward_year OR NEW.base_entitlement_hours IS DISTINCT FROM OLD.base_entitlement_hours OR NEW.public_holiday_credit_hours IS DISTINCT FROM OLD.public_holiday_credit_hours) AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) THEN RAISE EXCEPTION 'Only office admins may change opening leave entitlements'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER leave_opening_balance_office BEFORE UPDATE ON public.user_leave_balances FOR EACH ROW EXECUTE FUNCTION public.guard_leave_opening_balance();