CREATE TABLE public.company_price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  trade text NOT NULL DEFAULT 'custom',
  category text NOT NULL DEFAULT '',
  subcategory text NOT NULL DEFAULT '',
  code text,
  name text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'each',
  installation_method text,
  cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  unit_rate numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
  vat_rate numeric(5,2) NOT NULL DEFAULT 18 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  is_tally boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_price_list_items_company_trade ON public.company_price_list_items(company_id, trade, category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_price_list_items TO authenticated;
GRANT ALL ON public.company_price_list_items TO service_role;
ALTER TABLE public.company_price_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price list read in company" ON public.company_price_list_items FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY "price list office insert" ON public.company_price_list_items FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) AND public.company_module_access(company_id,'qs_pricing'));
CREATE POLICY "price list office update" ON public.company_price_list_items FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')))
  WITH CHECK (company_id = public.current_company_id() AND public.company_module_access(company_id,'qs_pricing'));
CREATE POLICY "price list office delete" ON public.company_price_list_items FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) AND public.company_module_access(company_id,'qs_pricing'));
CREATE TRIGGER company_price_list_items_touch BEFORE UPDATE ON public.company_price_list_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();