ALTER TABLE public.platform_catalog ADD COLUMN IF NOT EXISTS storage_gb integer NOT NULL DEFAULT 0;

CREATE SEQUENCE IF NOT EXISTS public.platform_invoice_seq START 1001;

CREATE TABLE public.platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.platform_subscriptions(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE DEFAULT ('FB-' || nextval('public.platform_invoice_seq')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','suspended','void')),
  collection text NOT NULL DEFAULT 'auto' CHECK (collection IN ('auto','manual')),
  currency text NOT NULL DEFAULT 'EUR',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 18,
  vat numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_ref text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_invoices TO authenticated;
GRANT ALL ON public.platform_invoices TO service_role;
GRANT USAGE ON SEQUENCE public.platform_invoice_seq TO authenticated, service_role;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_owner ON public.platform_invoices FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE POLICY invoices_tenant_read ON public.platform_invoices FOR SELECT TO authenticated USING (status <> 'draft' AND company_id = public.current_company_id() AND public.has_role(auth.uid(), 'superuser'));

CREATE FUNCTION public.guard_platform_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Issued invoices cannot be deleted; void them instead'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (NEW.lines IS DISTINCT FROM OLD.lines OR NEW.subtotal <> OLD.subtotal OR NEW.discount <> OLD.discount OR NEW.vat_rate <> OLD.vat_rate OR NEW.vat <> OLD.vat OR NEW.total <> OLD.total OR NEW.period_start <> OLD.period_start OR NEW.period_end <> OLD.period_end OR NEW.subscription_id <> OLD.subscription_id OR NEW.invoice_number <> OLD.invoice_number OR NEW.currency <> OLD.currency) THEN
    RAISE EXCEPTION 'Issued invoice amounts and lines are frozen';
  END IF;
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER platform_invoice_guard BEFORE UPDATE OR DELETE ON public.platform_invoices FOR EACH ROW EXECUTE FUNCTION public.guard_platform_invoice();

CREATE TABLE public.platform_invoice_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.platform_invoices(id) ON DELETE CASCADE,
  stage text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, stage)
);
GRANT SELECT, INSERT, DELETE ON public.platform_invoice_reminders TO authenticated;
GRANT ALL ON public.platform_invoice_reminders TO service_role;
ALTER TABLE public.platform_invoice_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminders_owner ON public.platform_invoice_reminders FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE POLICY reminders_tenant_read ON public.platform_invoice_reminders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.platform_invoices i WHERE i.id = invoice_id AND i.company_id = public.current_company_id() AND public.has_role(auth.uid(), 'superuser')));

CREATE FUNCTION public.company_storage_usage(_company uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE used bigint; allowance integer; s record;
BEGIN
  IF NOT (public.is_platform_owner() OR (_company = public.current_company_id() AND (public.has_role(auth.uid(),'superuser') OR public.has_role(auth.uid(),'admin')))) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT coalesce(sum((o.metadata->>'size')::bigint),0) INTO used FROM storage.objects o WHERE split_part(o.name,'/',1) = _company::text;
  SELECT * INTO s FROM public.platform_subscriptions WHERE company_id = _company ORDER BY created_at LIMIT 1;
  allowance := coalesce((SELECT sum(c.storage_gb) FROM public.platform_catalog c WHERE s.id IS NOT NULL AND (c.id = s.plan_id OR c.id = ANY(coalesce(s.pack_ids,'{}')))),0);
  IF allowance = 0 OR s.plan_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.platform_catalog WHERE id = s.plan_id AND storage_gb > 0) THEN allowance := allowance + 10; END IF;
  RETURN jsonb_build_object('used_bytes', used, 'allowance_gb', allowance);
END $$;
REVOKE ALL ON FUNCTION public.company_storage_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_storage_usage(uuid) TO authenticated;