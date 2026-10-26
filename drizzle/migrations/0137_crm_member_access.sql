ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS crm_access text CHECK (crm_access IN ('none','viewer','contributor','closer','manager'));

CREATE OR REPLACE FUNCTION public.crm_rank(_level text) RETURNS int LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE _level WHEN 'viewer' THEN 1 WHEN 'contributor' THEN 2 WHEN 'closer' THEN 3 WHEN 'manager' THEN 4 ELSE 0 END $$;

CREATE OR REPLACE FUNCTION public.crm_default_level(_role public.app_role) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN _role IN ('superuser','admin') THEN 'manager' WHEN _role='supervisor' THEN 'closer' ELSE 'none' END $$;

CREATE OR REPLACE FUNCTION public.my_crm_access() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN r.role='superuser' THEN 'manager' ELSE coalesce(r.crm_access, public.crm_default_level(r.role)) END
  FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.registration_status='active' LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.crm_can(_min text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.crm_rank(coalesce(public.my_crm_access(),'none')) >= public.crm_rank(_min) $$;

GRANT EXECUTE ON FUNCTION public.my_crm_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_can(text) TO authenticated;

-- Policies
DROP POLICY IF EXISTS "Managers manage company leads" ON public.crm_opportunities;
CREATE POLICY crm_leads_read ON public.crm_opportunities FOR SELECT TO authenticated USING (company_id=current_company_id() AND crm_can('viewer'));
CREATE POLICY crm_leads_insert ON public.crm_opportunities FOR INSERT TO authenticated WITH CHECK (company_id=current_company_id() AND crm_can('contributor'));
CREATE POLICY crm_leads_update ON public.crm_opportunities FOR UPDATE TO authenticated USING (company_id=current_company_id() AND crm_can('contributor')) WITH CHECK (company_id=current_company_id() AND crm_can('contributor'));
CREATE POLICY crm_leads_delete ON public.crm_opportunities FOR DELETE TO authenticated USING (company_id=current_company_id() AND crm_can('manager'));

DROP POLICY IF EXISTS "Managers read lead timeline" ON public.crm_activities;
DROP POLICY IF EXISTS "Managers add lead timeline" ON public.crm_activities;
CREATE POLICY crm_activities_read ON public.crm_activities FOR SELECT TO authenticated USING (company_id=current_company_id() AND crm_can('viewer'));
CREATE POLICY crm_activities_insert ON public.crm_activities FOR INSERT TO authenticated WITH CHECK (company_id=current_company_id() AND crm_can('contributor') AND created_by=auth.uid() AND EXISTS (SELECT 1 FROM public.crm_opportunities o WHERE o.id=opportunity_id AND o.company_id=current_company_id()));

DROP POLICY IF EXISTS "Managers manage follow-ups" ON public.crm_followups;
CREATE POLICY crm_followups_read ON public.crm_followups FOR SELECT TO authenticated USING (company_id=current_company_id() AND crm_can('viewer'));
CREATE POLICY crm_followups_insert ON public.crm_followups FOR INSERT TO authenticated WITH CHECK (company_id=current_company_id() AND crm_can('contributor') AND EXISTS (SELECT 1 FROM public.crm_opportunities o WHERE o.id=opportunity_id AND o.company_id=current_company_id()));
CREATE POLICY crm_followups_update ON public.crm_followups FOR UPDATE TO authenticated USING (company_id=current_company_id() AND crm_can('contributor')) WITH CHECK (company_id=current_company_id() AND crm_can('contributor'));
CREATE POLICY crm_followups_delete ON public.crm_followups FOR DELETE TO authenticated USING (company_id=current_company_id() AND crm_can('manager'));

DROP POLICY IF EXISTS "Managers manage follow-up types" ON public.crm_action_types;
CREATE POLICY crm_types_read ON public.crm_action_types FOR SELECT TO authenticated USING (company_id=current_company_id() AND crm_can('viewer'));
CREATE POLICY crm_types_write ON public.crm_action_types FOR ALL TO authenticated USING (company_id=current_company_id() AND crm_can('manager')) WITH CHECK (company_id=current_company_id() AND crm_can('manager'));

-- Stage changes need closer level
CREATE OR REPLACE FUNCTION public.crm_guard_stage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.stage IS DISTINCT FROM OLD.stage AND NOT public.crm_can('closer') THEN
    RAISE EXCEPTION 'Your CRM access does not allow changing lead stages';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_guard_stage ON public.crm_opportunities;
CREATE TRIGGER crm_guard_stage BEFORE UPDATE ON public.crm_opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_guard_stage();

-- Won conversion: closer level
CREATE OR REPLACE FUNCTION public.crm_mark_won(_id uuid, _target text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.crm_opportunities; v_quote uuid; v_job uuid;
BEGIN
  IF NOT public.crm_can('closer') THEN RAISE EXCEPTION 'Your CRM access does not allow closing leads'; END IF;
  SELECT * INTO o FROM public.crm_opportunities WHERE id = _id AND company_id = public.current_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF NOT public.company_module_access(o.company_id, 'crm_pipeline') THEN RAISE EXCEPTION 'This module is read-only for your company'; END IF;
  IF _target NOT IN ('none','quote','job','contract') THEN RAISE EXCEPTION 'Unknown conversion'; END IF;
  IF _target = 'quote' AND o.quote_id IS NULL THEN
    INSERT INTO public.customer_quotes(company_id, client_id, site_id, data, created_by)
    VALUES (o.company_id, o.client_id, o.site_id, jsonb_build_object('title', o.title, 'scope', o.title, 'lines', '[]'::jsonb), auth.uid()) RETURNING id INTO v_quote;
    UPDATE public.crm_opportunities SET quote_id = v_quote WHERE id = o.id;
  ELSIF _target = 'job' AND o.job_id IS NULL THEN
    IF o.client_id IS NULL THEN RAISE EXCEPTION 'Choose a client before creating a job'; END IF;
    INSERT INTO public.jobs(company_id, client_id, site_id, problem_summary, customer_quote_id)
    VALUES (o.company_id, o.client_id, o.site_id, o.title, o.quote_id) RETURNING id INTO v_job;
    UPDATE public.crm_opportunities SET job_id = v_job WHERE id = o.id;
  END IF;
  UPDATE public.crm_opportunities SET stage = 'won' WHERE id = o.id AND stage <> 'won';
  UPDATE public.crm_followups SET done_at = now() WHERE opportunity_id = o.id AND done_at IS NULL;
  RETURN jsonb_build_object('quote_id', coalesce(v_quote, o.quote_id), 'job_id', coalesce(v_job, o.job_id), 'target', _target);
END $function$;

-- Permanent delete (manager only)
CREATE OR REPLACE FUNCTION public.crm_delete_lead(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.crm_can('manager') THEN RAISE EXCEPTION 'Only CRM managers can delete leads'; END IF;
  PERFORM 1 FROM public.crm_opportunities WHERE id=_id AND company_id=public.current_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  DELETE FROM public.crm_followups WHERE opportunity_id=_id;
  DELETE FROM public.crm_activities WHERE opportunity_id=_id;
  DELETE FROM public.crm_opportunities WHERE id=_id;
END $$;
GRANT EXECUTE ON FUNCTION public.crm_delete_lead(uuid) TO authenticated;

-- Admin sets per-member CRM access
CREATE OR REPLACE FUNCTION public.set_member_crm_access(_user uuid, _level text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid = public.current_company_id(); target public.user_roles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _level IS NOT NULL AND _level NOT IN ('none','viewer','contributor','closer','manager') THEN RAISE EXCEPTION 'Unknown CRM access level'; END IF;
  SELECT * INTO target FROM public.user_roles WHERE user_id=_user AND company_id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF target.role='superuser' THEN RAISE EXCEPTION 'Company superusers always have full CRM access'; END IF;
  IF NOT (public.has_role(auth.uid(),'superuser') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only a company superuser or office admin can change CRM access';
  END IF;
  UPDATE public.user_roles SET crm_access=_level WHERE user_id=_user AND company_id=c;
END $$;
GRANT EXECUTE ON FUNCTION public.set_member_crm_access(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_member_capabilities() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.can_field_dispatch IS DISTINCT FROM OLD.can_field_dispatch OR NEW.can_commercial_access IS DISTINCT FROM OLD.can_commercial_access OR NEW.crm_access IS DISTINCT FROM OLD.crm_access THEN
    IF NOT (public.has_role(auth.uid(),'superuser') OR (public.has_role(auth.uid(),'admin') AND OLD.role <> 'superuser')) THEN
      RAISE EXCEPTION 'Only a company superuser or office admin can change capabilities';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- Supervisors see full team sheet history
DROP POLICY IF EXISTS field_sheet_history_limit ON public.job_sheets;
CREATE POLICY field_sheet_history_limit ON public.job_sheets AS RESTRICTIVE FOR SELECT TO authenticated USING (
  company_id = current_company_id() AND (
    my_role() = ANY (ARRAY['admin'::app_role,'superuser'::app_role,'supervisor'::app_role])
    OR status <> 'completed'::job_status
    OR created_at >= now() - make_interval(months => COALESCE((SELECT cs.field_sheet_history_months FROM company_settings cs WHERE cs.company_id = current_company_id()), 12))));