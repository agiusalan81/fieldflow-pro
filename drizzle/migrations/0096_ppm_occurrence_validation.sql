CREATE FUNCTION public.validate_ppm_occurrence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.ppm_plans; a public.maintenance_agreements; matched boolean=false; n integer;
BEGIN
 IF NEW.ppm_plan_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.ppm_plans WHERE id=NEW.ppm_plan_id AND company_id=NEW.company_id;
 SELECT * INTO a FROM public.maintenance_agreements WHERE id=p.agreement_id AND company_id=p.company_id;
 IF NOT p.active OR a.status<>'active' THEN RAISE EXCEPTION 'Maintenance plan and agreement must be active'; END IF;
 FOR n IN 0..60 LOOP
  IF (p.first_due_date+make_interval(months=>n*p.interval_months))::date=NEW.ppm_due_date THEN matched=true; EXIT; END IF;
 END LOOP;
 IF NOT matched THEN RAISE EXCEPTION 'Maintenance visit must match the anchored contract cadence'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ppm_occurrence_validation BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.validate_ppm_occurrence();