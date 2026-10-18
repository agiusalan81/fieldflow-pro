CREATE FUNCTION public.save_employee_payroll_setup(_user uuid, _year integer, _wage jsonb, _config jsonb, _opening jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE _company uuid := public.current_company_id();
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=_user AND company_id=_company) THEN RAISE EXCEPTION 'Office access to this employee is required'; END IF;
 IF _year < 2000 OR _year > 2200 OR (_opening->>'base')::numeric < 0 OR (_opening->>'ph')::numeric < 0 OR (_opening->>'carried')::numeric < 0 THEN RAISE EXCEPTION 'Invalid year or opening leave values'; END IF;
 INSERT INTO public.employee_payroll_settings(company_id,user_id,entitlement_year,hourly_rate,sick_full_hours,sick_half_hours,tax_reference,payroll_config) VALUES(_company,_user,_year,(_wage->>'hourly_rate')::numeric,(_wage->>'sick_full_hours')::numeric,(_wage->>'sick_half_hours')::numeric,_wage->>'tax_reference',_config) ON CONFLICT(company_id,user_id,entitlement_year) DO UPDATE SET hourly_rate=EXCLUDED.hourly_rate,sick_full_hours=EXCLUDED.sick_full_hours,sick_half_hours=EXCLUDED.sick_half_hours,tax_reference=EXCLUDED.tax_reference,payroll_config=EXCLUDED.payroll_config,updated_at=now();
 INSERT INTO public.user_leave_balances(company_id,user_id,base_entitlement_hours,public_holiday_credit_hours,carried_forward_hours,carried_forward_year) VALUES(_company,_user,(_opening->>'base')::numeric,(_opening->>'ph')::numeric,(_opening->>'carried')::numeric,_year) ON CONFLICT(user_id) DO UPDATE SET base_entitlement_hours=EXCLUDED.base_entitlement_hours,public_holiday_credit_hours=EXCLUDED.public_holiday_credit_hours,carried_forward_hours=EXCLUDED.carried_forward_hours,carried_forward_year=EXCLUDED.carried_forward_year WHERE user_leave_balances.company_id=_company;
 IF NOT FOUND THEN RAISE EXCEPTION 'Leave balance does not belong to this company'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_employee_payroll_setup(uuid,integer,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_employee_payroll_setup(uuid,integer,jsonb,jsonb,jsonb) TO authenticated;
CREATE FUNCTION public.guard_issued_payroll_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Issued payslips cannot be changed or deleted'; END IF;
 IF NEW.snapshot->>'from' IS DISTINCT FROM NEW.period_start::text OR NEW.snapshot->>'to' IS DISTINCT FROM NEW.period_end::text OR (NEW.snapshot->'totals'->>'gross')::numeric IS DISTINCT FROM NEW.gross_eur OR (NEW.snapshot->'totals'->>'net')::numeric IS DISTINCT FROM NEW.net_eur THEN RAISE EXCEPTION 'Payslip snapshot and recorded totals must agree'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payroll_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_payslips FOR EACH ROW EXECUTE FUNCTION public.guard_issued_payroll_snapshot();
COMMENT ON TABLE public.payroll_payslips IS 'Immutable office-reviewed payroll snapshots; annual statutory tables and employee category eligibility require office approval. Legacy snapshots may contain manually reviewed deductions.';