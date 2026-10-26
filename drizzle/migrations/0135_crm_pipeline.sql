CREATE TABLE public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  deal_type text NOT NULL DEFAULT 'repair',
  source text NOT NULL DEFAULT 'phone',
  value numeric(12,2) CHECK (value IS NULL OR value >= 0),
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','site_visit','quote_sent','negotiation','won','lost')),
  owner_id uuid DEFAULT auth.uid(),
  lost_reason text,
  quote_id uuid REFERENCES public.customer_quotes(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_opportunities TO authenticated;
GRANT ALL ON public.crm_opportunities TO service_role;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage company leads" ON public.crm_opportunities FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE INDEX crm_opportunities_company_stage ON public.crm_opportunities(company_id, stage);
CREATE INDEX crm_opportunities_client ON public.crm_opportunities(client_id);

CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note','call','whatsapp','email','meeting','stage','followup','system')),
  body text NOT NULL CHECK (length(body) <= 10000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read lead timeline" ON public.crm_activities FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Managers add lead timeline" ON public.crm_activities FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager() AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.crm_opportunities o WHERE o.id = opportunity_id AND o.company_id = company_id));
CREATE INDEX crm_activities_opp ON public.crm_activities(opportunity_id, created_at);

CREATE TABLE public.crm_action_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 60),
  icon text NOT NULL DEFAULT 'phone',
  due_hours integer NOT NULL DEFAULT 24 CHECK (due_hours BETWEEN 0 AND 8760),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_action_types TO authenticated;
GRANT ALL ON public.crm_action_types TO service_role;
ALTER TABLE public.crm_action_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage follow-up types" ON public.crm_action_types FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());

CREATE TABLE public.crm_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  action_label text NOT NULL CHECK (length(btrim(action_label)) BETWEEN 1 AND 60),
  due_at timestamptz NOT NULL,
  assignee_id uuid DEFAULT auth.uid(),
  notes text NOT NULL DEFAULT '',
  done_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_followups TO authenticated;
GRANT ALL ON public.crm_followups TO service_role;
ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage follow-ups" ON public.crm_followups FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager()
    AND EXISTS (SELECT 1 FROM public.crm_opportunities o WHERE o.id = opportunity_id AND o.company_id = company_id));
CREATE INDEX crm_followups_due ON public.crm_followups(company_id, due_at) WHERE done_at IS NULL;

CREATE TRIGGER crm_opportunities_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.crm_opportunities FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('crm_pipeline');
CREATE TRIGGER crm_activities_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.crm_activities FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('crm_pipeline');
CREATE TRIGGER crm_action_types_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.crm_action_types FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('crm_pipeline');
CREATE TRIGGER crm_followups_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.crm_followups FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('crm_pipeline');

-- Keep client/site inside the tenant, log stage changes, maintain timestamps.
CREATE OR REPLACE FUNCTION public.crm_opportunity_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.company_id = NEW.company_id) THEN RAISE EXCEPTION 'Client not found'; END IF;
  IF NEW.site_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = NEW.site_id AND s.company_id = NEW.company_id) THEN RAISE EXCEPTION 'Site not found'; END IF;
  IF NEW.stage = 'lost' AND coalesce(btrim(NEW.lost_reason), '') = '' THEN RAISE EXCEPTION 'A lost reason is required'; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.company_id := OLD.company_id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      NEW.closed_at := CASE WHEN NEW.stage IN ('won','lost') THEN now() ELSE NULL END;
      IF NEW.stage <> 'lost' THEN NEW.lost_reason := NULL; END IF;
    END IF;
  ELSE
    NEW.closed_at := CASE WHEN NEW.stage IN ('won','lost') THEN now() ELSE NULL END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_opportunity_integrity BEFORE INSERT OR UPDATE ON public.crm_opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_opportunity_integrity();

CREATE OR REPLACE FUNCTION public.crm_log_stage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.crm_activities(company_id, opportunity_id, kind, body, created_by)
    VALUES (NEW.company_id, NEW.id, 'stage', 'Stage: ' || OLD.stage || ' → ' || NEW.stage || CASE WHEN NEW.stage = 'lost' THEN ' (' || NEW.lost_reason || ')' ELSE '' END, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_log_stage AFTER UPDATE ON public.crm_opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_log_stage();

CREATE OR REPLACE FUNCTION public.crm_create_lead(_lead jsonb, _note text DEFAULT '', _followup jsonb DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.crm_opportunities(client_id, site_id, title, contact_name, contact_phone, contact_email, deal_type, source, value)
  VALUES (nullif(_lead->>'client_id','')::uuid, nullif(_lead->>'site_id','')::uuid, btrim(_lead->>'title'),
    coalesce(_lead->>'contact_name',''), coalesce(_lead->>'contact_phone',''), coalesce(_lead->>'contact_email',''),
    coalesce(nullif(_lead->>'deal_type',''),'repair'), coalesce(nullif(_lead->>'source',''),'phone'), nullif(_lead->>'value','')::numeric)
  RETURNING id INTO v_id;
  IF coalesce(btrim(_note),'') <> '' THEN
    INSERT INTO public.crm_activities(opportunity_id, kind, body) VALUES (v_id, 'call', btrim(_note));
  END IF;
  IF _followup IS NOT NULL THEN
    INSERT INTO public.crm_followups(opportunity_id, action_key, action_label, due_at, notes)
    VALUES (v_id, _followup->>'action_key', _followup->>'action_label', (_followup->>'due_at')::timestamptz, coalesce(_followup->>'notes',''));
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.crm_create_lead(jsonb, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_create_lead(jsonb, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_mark_won(_id uuid, _target text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.crm_opportunities; v_quote uuid; v_job uuid;
BEGIN
  IF NOT public.is_company_manager() THEN RAISE EXCEPTION 'Office or supervisor access required'; END IF;
  SELECT * INTO o FROM public.crm_opportunities WHERE id = _id AND company_id = public.current_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF NOT public.company_module_access(o.company_id, 'crm_pipeline') THEN RAISE EXCEPTION 'This module is read-only for your company'; END IF;
  IF _target NOT IN ('none','quote','job','contract') THEN RAISE EXCEPTION 'Unknown conversion'; END IF;
  IF _target = 'quote' AND o.quote_id IS NULL THEN
    INSERT INTO public.customer_quotes(company_id, client_id, site_id, data, created_by)
    VALUES (o.company_id, o.client_id, o.site_id, jsonb_build_object('title', o.title, 'scope', o.title), auth.uid()) RETURNING id INTO v_quote;
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
END $$;
REVOKE ALL ON FUNCTION public.crm_mark_won(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_mark_won(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_mark_lost(_id uuid, _reason text, _recontact_at timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A lost reason is required'; END IF;
  UPDATE public.crm_opportunities SET stage = 'lost', lost_reason = btrim(_reason) WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  UPDATE public.crm_followups SET done_at = now() WHERE opportunity_id = _id AND done_at IS NULL;
  IF _recontact_at IS NOT NULL THEN
    INSERT INTO public.crm_followups(opportunity_id, action_key, action_label, due_at, notes)
    VALUES (_id, 'default:recontact', 'Re-contact lost lead', _recontact_at, btrim(_reason));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.crm_mark_lost(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_mark_lost(uuid, text, timestamptz) TO authenticated;

-- Estimates move matching open leads along; acceptance is logged for the office.
CREATE OR REPLACE FUNCTION public.crm_track_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_opp uuid;
BEGIN
  IF NOT public.company_module_access(NEW.company_id, 'crm_pipeline') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL THEN
    SELECT id INTO v_opp FROM public.crm_opportunities
     WHERE company_id = NEW.company_id AND client_id = NEW.client_id AND quote_id IS NULL AND stage IN ('new','contacted','site_visit')
     ORDER BY created_at DESC LIMIT 1;
    IF v_opp IS NOT NULL THEN
      UPDATE public.crm_opportunities SET quote_id = NEW.id, stage = 'quote_sent' WHERE id = v_opp;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','declined') THEN
    INSERT INTO public.crm_activities(company_id, opportunity_id, kind, body, created_by)
    SELECT o.company_id, o.id, 'system', 'Estimate ' || NEW.reference || ' ' || NEW.status || CASE WHEN NEW.status = 'accepted' THEN ' — consider marking this lead as won' ELSE '' END, NULL
      FROM public.crm_opportunities o WHERE o.quote_id = NEW.id AND o.stage NOT IN ('won','lost');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_track_quote AFTER INSERT OR UPDATE OF status ON public.customer_quotes FOR EACH ROW EXECUTE FUNCTION public.crm_track_quote();