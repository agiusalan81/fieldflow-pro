ALTER TABLE public.lift_costing_sheets ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.crm_start_estimate(_id uuid, _kind text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.crm_opportunities; v_quote uuid; v_sheet uuid;
BEGIN
  IF NOT public.crm_can('contributor') THEN RAISE EXCEPTION 'Your CRM access does not allow creating estimates'; END IF;
  SELECT * INTO o FROM public.crm_opportunities WHERE id = _id AND company_id = public.current_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF o.stage IN ('won','lost') THEN RAISE EXCEPTION 'Reopen the lead first'; END IF;
  IF _kind = 'quote' THEN
    IF o.quote_id IS NOT NULL THEN RETURN jsonb_build_object('quote_id', o.quote_id); END IF;
    INSERT INTO public.customer_quotes(company_id, client_id, site_id, data, created_by)
    VALUES (o.company_id, o.client_id, o.site_id, jsonb_build_object('title', o.title, 'scope', o.title, 'lines', '[]'::jsonb), auth.uid()) RETURNING id INTO v_quote;
    UPDATE public.crm_opportunities SET quote_id = v_quote, stage = CASE WHEN stage IN ('new','contacted','site_visit') THEN 'quote_sent' ELSE stage END WHERE id = o.id;
    RETURN jsonb_build_object('quote_id', v_quote);
  ELSIF _kind = 'lift' THEN
    IF NOT public.company_module_access(o.company_id, 'lift_pack') THEN RAISE EXCEPTION 'Lifts & Escalators pack is not active'; END IF;
    SELECT id INTO v_sheet FROM public.lift_costing_sheets WHERE opportunity_id = o.id AND company_id = o.company_id ORDER BY created_at DESC LIMIT 1;
    IF v_sheet IS NULL THEN
      INSERT INTO public.lift_costing_sheets(company_id, title, opportunity_id) VALUES (o.company_id, o.title, o.id) RETURNING id INTO v_sheet;
    END IF;
    RETURN jsonb_build_object('sheet_id', v_sheet);
  END IF;
  RAISE EXCEPTION 'Unknown estimate type';
END $$;
REVOKE ALL ON FUNCTION public.crm_start_estimate(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_start_estimate(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lift_costing_link_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.opportunity_id IS NOT NULL AND NEW.quote_id IS NOT NULL AND NEW.quote_id IS DISTINCT FROM OLD.quote_id THEN
    UPDATE public.crm_opportunities SET quote_id = NEW.quote_id, stage = CASE WHEN stage IN ('new','contacted','site_visit') THEN 'quote_sent' ELSE stage END
     WHERE id = NEW.opportunity_id AND company_id = NEW.company_id AND stage NOT IN ('won','lost');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lift_costing_link_lead ON public.lift_costing_sheets;
CREATE TRIGGER lift_costing_link_lead AFTER UPDATE OF quote_id ON public.lift_costing_sheets FOR EACH ROW EXECUTE FUNCTION public.lift_costing_link_lead();