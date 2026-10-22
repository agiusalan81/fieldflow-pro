ALTER TABLE public.platform_subscriptions
  ADD COLUMN IF NOT EXISTS auto_issue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_charge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS pending_change jsonb;

ALTER TABLE public.platform_invoices
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'renewal',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS payment_error text;
ALTER TABLE public.platform_invoices ADD CONSTRAINT platform_invoices_kind_check CHECK (kind IN ('renewal','upgrade'));
ALTER TABLE public.platform_invoices DROP CONSTRAINT IF EXISTS platform_invoices_subscription_id_period_start_key;
ALTER TABLE public.platform_invoices ADD CONSTRAINT platform_invoices_sub_period_kind_key UNIQUE (subscription_id, period_start, kind);

CREATE TABLE public.platform_payment_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_payment_events TO service_role;
ALTER TABLE public.platform_payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_events_owner_read ON public.platform_payment_events FOR SELECT TO authenticated USING (public.is_platform_owner());
GRANT SELECT ON public.platform_payment_events TO authenticated;

-- Unpaid issued invoices more than 14 days past due make the company read-only until paid.
CREATE OR REPLACE FUNCTION public.company_invoice_lapsed(_subscription uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_invoices WHERE subscription_id=_subscription AND status IN ('sent','overdue','suspended') AND due_date + 14 < current_date);
$$;
REVOKE ALL ON FUNCTION public.company_invoice_lapsed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_invoice_lapsed(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.company_module_access(_company uuid, _module text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE s public.platform_subscriptions; p public.platform_products; o boolean; BEGIN SELECT * INTO p FROM public.platform_products WHERE id=public.company_app_product_id(); SELECT * INTO s FROM public.platform_subscriptions WHERE company_id=_company AND product_id=p.id LIMIT 1; IF NOT FOUND OR s.status='legacy' THEN RETURN true; END IF; IF s.status='trial' THEN RETURN s.trial_ends_at>now(); END IF; IF s.status<>'active' THEN RETURN false; END IF; IF public.company_invoice_lapsed(s.id) THEN RETURN false; END IF; IF NOT (_module=ANY(p.modules)) THEN RETURN true; END IF; SELECT enabled INTO o FROM public.platform_overrides WHERE subscription_id=s.id AND module=_module AND starts_at<=now() AND ends_at>now() ORDER BY created_at DESC LIMIT 1; IF FOUND THEN RETURN o; END IF; IF _module='core' THEN RETURN true; END IF; RETURN EXISTS(SELECT 1 FROM public.platform_catalog c WHERE c.product_id=p.id AND (c.id=s.plan_id OR c.id=ANY(s.pack_ids)) AND _module=ANY(c.modules)); END $$;

CREATE OR REPLACE FUNCTION public.my_commercial_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE s public.platform_subscriptions; p public.platform_products; BEGIN SELECT * INTO p FROM public.platform_products WHERE id=public.company_app_product_id(); SELECT * INTO s FROM public.platform_subscriptions WHERE company_id=public.current_company_id() AND product_id=p.id LIMIT 1; IF NOT FOUND THEN RETURN jsonb_build_object('state','legacy','writable',true,'modules','[]'::jsonb); END IF; RETURN jsonb_build_object('state',CASE WHEN s.status='trial' AND s.trial_ends_at<=now() THEN 'read_only' WHEN s.status='active' AND public.company_invoice_lapsed(s.id) THEN 'read_only' ELSE s.status END,'invoice_lapsed',public.company_invoice_lapsed(s.id),'trial_ends_at',s.trial_ends_at,'writable',public.company_module_access(s.company_id,'core'),'modules',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',m,'enabled',public.company_module_access(s.company_id,m))),'[]'::jsonb) FROM unnest(p.modules) m),'branding',(SELECT branding_required FROM public.platform_catalog WHERE id=s.plan_id)); END $$;