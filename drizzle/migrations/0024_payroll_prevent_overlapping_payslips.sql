CREATE OR REPLACE FUNCTION public.guard_payroll_payslip_period() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) THEN RAISE EXCEPTION 'Only office admins may issue payroll'; END IF;
 IF EXTRACT(YEAR FROM NEW.period_start) <> EXTRACT(YEAR FROM NEW.period_end) THEN RAISE EXCEPTION 'Payroll period must be within a single calendar year'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text || ':' || NEW.user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.payroll_payslips p WHERE p.company_id=NEW.company_id AND p.user_id=NEW.user_id AND p.period_start<=NEW.period_end AND p.period_end>=NEW.period_start) THEN RAISE EXCEPTION 'An issued payslip already covers part of this period'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER payroll_payslips_no_overlap BEFORE INSERT ON public.payroll_payslips FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_payslip_period();