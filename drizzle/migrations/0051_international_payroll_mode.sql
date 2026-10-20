ALTER TABLE public.company_settings ADD COLUMN payroll_mode text NOT NULL DEFAULT 'universal_gross' CHECK (payroll_mode IN ('universal_gross','statutory_malta'));
UPDATE public.company_settings SET payroll_mode='statutory_malta';
CREATE FUNCTION public.guard_payroll_mode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND (TG_OP='INSERT' OR NEW.payroll_mode IS DISTINCT FROM OLD.payroll_mode) THEN
  IF NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) THEN RAISE EXCEPTION 'Only office admins may select payroll mode'; END IF;
  IF NEW.payroll_mode='statutory_malta' AND NOT public.company_module_access(NEW.company_id,'payroll_statutory_mt') THEN RAISE EXCEPTION 'Malta statutory payroll requires a country compliance pack'; END IF;
 END IF;
 IF NEW.payroll_mode='statutory_malta' AND NEW.currency<>'EUR' THEN RAISE EXCEPTION 'Malta statutory payroll requires EUR'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER company_payroll_mode_guard BEFORE INSERT OR UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_mode();
CREATE FUNCTION public.guard_payroll_country_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE mode text; curr text; BEGIN
 SELECT payroll_mode,currency INTO mode,curr FROM public.company_settings WHERE company_id=NEW.company_id;
 mode=coalesce(mode,'universal_gross');curr=coalesce(curr,'EUR');
 IF coalesce(NEW.snapshot->>'payrollMode','statutory_malta')<>mode THEN RAISE EXCEPTION 'Payroll mode changed; refresh and review before issuing'; END IF;
 IF mode='statutory_malta' AND NOT public.company_module_access(NEW.company_id,'payroll_statutory_mt') THEN RAISE EXCEPTION 'Malta statutory payroll requires a country compliance pack'; END IF;
 IF mode='universal_gross' THEN
  IF NEW.snapshot->>'currency' IS DISTINCT FROM curr THEN RAISE EXCEPTION 'Payroll currency changed; refresh before issuing'; END IF;
  IF NEW.gross_eur<>NEW.net_eur OR (NEW.snapshot->'totals'->>'deductions')::numeric IS DISTINCT FROM 0 OR (NEW.snapshot->'adjustments'->>'tax')::numeric IS DISTINCT FROM 0 OR (NEW.snapshot->'adjustments'->>'nationalInsurance')::numeric IS DISTINCT FROM 0 OR (NEW.snapshot->'adjustments'->>'otherDeductions')::numeric IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Universal summaries record gross earnings only, not statutory net pay'; END IF;
 END IF;
 RETURN NEW; END $$;
CREATE TRIGGER payroll_country_snapshot_guard BEFORE INSERT ON public.payroll_payslips FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_country_snapshot();
COMMENT ON COLUMN public.payroll_payslips.gross_eur IS 'Legacy name: amount in immutable snapshot currency; snapshots without currency are EUR.';
COMMENT ON COLUMN public.payroll_payslips.net_eur IS 'Legacy name: net for Malta or gross for universal summary, in snapshot currency.';