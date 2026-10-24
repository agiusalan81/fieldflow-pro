CREATE TABLE public.ppm_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id), agreement_id uuid NOT NULL REFERENCES public.maintenance_agreements(id), asset_id uuid NOT NULL REFERENCES public.assets(id), interval_months integer NOT NULL DEFAULT 1 CHECK(interval_months IN (1,2,3,4,6,12)), first_due_date date NOT NULL, grace_days integer NOT NULL DEFAULT 0 CHECK(grace_days BETWEEN 0 AND 30), assigned_technician_id uuid REFERENCES public.users(id), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(agreement_id,asset_id)
);
GRANT SELECT,INSERT,UPDATE ON public.ppm_plans TO authenticated;
GRANT ALL ON public.ppm_plans TO service_role;
ALTER TABLE public.ppm_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppm_read ON public.ppm_plans FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY ppm_write ON public.ppm_plans FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid())) WITH CHECK(company_id=public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()));
ALTER TABLE public.jobs ADD COLUMN ppm_plan_id uuid REFERENCES public.ppm_plans(id), ADD COLUMN ppm_due_date date, ADD COLUMN ppm_deadline date;
CREATE UNIQUE INDEX jobs_ppm_occurrence ON public.jobs(ppm_plan_id,ppm_due_date) WHERE ppm_plan_id IS NOT NULL;
CREATE FUNCTION public.guard_ppm_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.maintenance_agreements; equipment public.assets;
BEGIN
 IF NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT public.is_company_manager() OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Only active company managers can configure maintenance automation'; END IF;
 IF NOT public.company_module_access(NEW.company_id,'ppm_automation') OR NOT public.company_module_access(NEW.company_id,'core') THEN RAISE EXCEPTION 'Commercial PPM service pack is not enabled'; END IF;
 SELECT * INTO a FROM public.maintenance_agreements WHERE id=NEW.agreement_id AND company_id=NEW.company_id;
 SELECT * INTO equipment FROM public.assets WHERE id=NEW.asset_id AND company_id=NEW.company_id;
 IF a.id IS NULL OR equipment.id IS NULL OR equipment.client_id<>a.client_id OR (a.site_id IS NOT NULL AND equipment.site_id IS DISTINCT FROM a.site_id) THEN RAISE EXCEPTION 'Choose equipment covered by this company agreement'; END IF;
 IF NEW.first_due_date<a.start_date OR NEW.first_due_date>a.end_date OR a.end_date>NEW.first_due_date+interval '5 years' THEN RAISE EXCEPTION 'First visit must be inside an agreement of at most five years'; END IF;
 IF NEW.active AND a.status<>'active' THEN RAISE EXCEPTION 'Agreement must be active'; END IF;
 IF NEW.assigned_technician_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.assigned_technician_id AND company_id=NEW.company_id AND role IN ('technician','supervisor') AND registration_status='active') THEN RAISE EXCEPTION 'Choose an active company technician or supervisor'; END IF;
 IF TG_OP='UPDATE' AND (NEW.company_id,NEW.agreement_id,NEW.asset_id,NEW.first_due_date,NEW.interval_months) IS DISTINCT FROM (OLD.company_id,OLD.agreement_id,OLD.asset_id,OLD.first_due_date,OLD.interval_months) THEN RAISE EXCEPTION 'Coverage and cadence cannot change after saving; pause this plan instead'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ppm_plan_guard BEFORE INSERT OR UPDATE ON public.ppm_plans FOR EACH ROW EXECUTE FUNCTION public.guard_ppm_plan();
CREATE FUNCTION public.generate_ppm_visits(_plan uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.ppm_plans; a public.maintenance_agreements; equipment public.assets; n integer; due date; added integer=0; count_added integer;
BEGIN
 IF NOT public.is_company_manager() OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Manager access required'; END IF;
 SELECT * INTO p FROM public.ppm_plans WHERE id=_plan AND company_id=public.current_company_id() FOR UPDATE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Maintenance plan unavailable'; END IF;
 IF NOT public.company_module_access(p.company_id,'ppm_automation') OR NOT public.company_module_access(p.company_id,'core') THEN RAISE EXCEPTION 'Commercial PPM service pack is not enabled'; END IF;
 SELECT * INTO a FROM public.maintenance_agreements WHERE id=p.agreement_id AND company_id=p.company_id;
 IF NOT p.active OR a.status<>'active' THEN RETURN 0; END IF;
 IF a.end_date>p.first_due_date+interval '5 years' THEN RAISE EXCEPTION 'Generate at most five years of visits'; END IF;
 SELECT * INTO equipment FROM public.assets WHERE id=p.asset_id AND company_id=p.company_id;
 FOR n IN 0..60 LOOP
  due=(p.first_due_date+make_interval(months=>n*p.interval_months))::date;
  EXIT WHEN due>a.end_date;
  IF due<a.start_date THEN CONTINUE; END IF;
  INSERT INTO public.jobs(company_id,client_id,site_id,asset_id,assigned_technician_id,scheduled_date,problem_summary,ppm_plan_id,ppm_due_date,ppm_deadline)
  VALUES(p.company_id,a.client_id,equipment.site_id,p.asset_id,p.assigned_technician_id,due,'Planned maintenance · '||equipment.reference_number,p.id,due,due+p.grace_days)
  ON CONFLICT(ppm_plan_id,ppm_due_date) WHERE ppm_plan_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS count_added=ROW_COUNT; added=added+count_added;
 END LOOP;
 RETURN added;
END $$;
REVOKE ALL ON FUNCTION public.generate_ppm_visits(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_ppm_visits(uuid) TO authenticated;
CREATE FUNCTION public.ppm_plan_generate() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN PERFORM public.generate_ppm_visits(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER ppm_plan_generate AFTER INSERT ON public.ppm_plans FOR EACH ROW EXECUTE FUNCTION public.ppm_plan_generate();
CREATE FUNCTION public.guard_ppm_job() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.ppm_plans; a public.maintenance_agreements;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.ppm_plan_id IS NOT NULL AND (NEW.ppm_plan_id,NEW.ppm_due_date,NEW.ppm_deadline,NEW.company_id,NEW.client_id,NEW.asset_id,NEW.site_id) IS DISTINCT FROM (OLD.ppm_plan_id,OLD.ppm_due_date,OLD.ppm_deadline,OLD.company_id,OLD.client_id,OLD.asset_id,OLD.site_id) THEN RAISE EXCEPTION 'Generated maintenance identity and deadlines are immutable'; END IF;
 END IF;
 IF NEW.ppm_plan_id IS NULL THEN
  IF NEW.ppm_due_date IS NOT NULL OR NEW.ppm_deadline IS NOT NULL THEN RAISE EXCEPTION 'Maintenance dates require a plan'; END IF; RETURN NEW;
 END IF;
 SELECT * INTO p FROM public.ppm_plans WHERE id=NEW.ppm_plan_id AND company_id=NEW.company_id;
 SELECT * INTO a FROM public.maintenance_agreements WHERE id=p.agreement_id AND company_id=p.company_id;
 IF p.id IS NULL OR NEW.asset_id IS DISTINCT FROM p.asset_id OR NEW.client_id IS DISTINCT FROM a.client_id OR NEW.site_id IS DISTINCT FROM (SELECT site_id FROM public.assets WHERE id=p.asset_id) THEN RAISE EXCEPTION 'Maintenance visit must match covered equipment'; END IF;
 IF TG_OP='INSERT' OR (NEW.assigned_technician_id,NEW.scheduled_date) IS DISTINCT FROM (OLD.assigned_technician_id,OLD.scheduled_date) THEN
  IF NOT public.is_company_manager() OR NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT public.company_module_access(NEW.company_id,'ppm_automation') THEN RAISE EXCEPTION 'Enabled maintenance pack and manager access required'; END IF;
 END IF;
 IF TG_OP='INSERT' AND (NEW.ppm_due_date IS NULL OR NEW.ppm_due_date<a.start_date OR NEW.ppm_due_date>a.end_date OR NEW.ppm_deadline IS DISTINCT FROM NEW.ppm_due_date+p.grace_days) THEN RAISE EXCEPTION 'Invalid maintenance deadline'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ppm_job_guard BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_ppm_job();
CREATE TABLE public.asset_component_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id),asset_id uuid NOT NULL REFERENCES public.assets(id),component text NOT NULL CHECK(length(trim(component)) BETWEEN 1 AND 120),event_date date NOT NULL DEFAULT CURRENT_DATE,event_type text NOT NULL CHECK(event_type IN ('replaced','inspected','repaired')),details text NOT NULL DEFAULT '' CHECK(length(details)<=2000),warranty_until date,created_by uuid NOT NULL DEFAULT auth.uid(),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.asset_component_events TO authenticated;
GRANT ALL ON public.asset_component_events TO service_role;
ALTER TABLE public.asset_component_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY component_read ON public.asset_component_events FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY component_insert ON public.asset_component_events FOR INSERT TO authenticated WITH CHECK(company_id=public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()));
CREATE FUNCTION public.guard_component_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Component history is append-only'; END IF;
 IF NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT public.is_company_manager() OR NOT public.member_is_active(auth.uid()) OR NOT public.company_module_access(NEW.company_id,'ppm_automation') OR NOT public.company_module_access(NEW.company_id,'core') THEN RAISE EXCEPTION 'Enabled PPM pack and manager access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.assets WHERE id=NEW.asset_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Equipment unavailable'; END IF;
 IF NEW.warranty_until<NEW.event_date THEN RAISE EXCEPTION 'Warranty cannot end before the event'; END IF;
 NEW.created_by=auth.uid(); RETURN NEW;
END $$;
CREATE TRIGGER component_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.asset_component_events FOR EACH ROW EXECUTE FUNCTION public.guard_component_event();