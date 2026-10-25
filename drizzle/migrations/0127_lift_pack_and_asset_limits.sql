ALTER TABLE public.platform_catalog ADD COLUMN IF NOT EXISTS asset_limit integer CHECK (asset_limit IS NULL OR asset_limit >= 0);
COMMENT ON COLUMN public.platform_catalog.asset_limit IS 'Plans: included assets (NULL = unlimited). Packs: extra assets added on top.';
UPDATE public.platform_catalog c SET asset_limit = CASE c.name WHEN 'Basic' THEN 50 WHEN 'Plus' THEN 150 WHEN 'Pro' THEN 300 ELSE NULL END
 FROM public.platform_products p WHERE p.id=c.product_id AND p.slug='fieldbridge' AND c.kind='plan';
INSERT INTO public.platform_catalog (product_id,name,kind,state,monthly_price,quarterly_price,yearly_price,modules,included_seats,sort_order,billing_basis,storage_gb)
SELECT p.id,'Lifts & Escalators','pack','draft',79,225,850,ARRAY['lift_pack'],0,95,'company',0 FROM public.platform_products p
WHERE p.slug='fieldbridge' AND NOT EXISTS (SELECT 1 FROM public.platform_catalog c WHERE c.product_id=p.id AND 'lift_pack'=ANY(c.modules));

CREATE OR REPLACE FUNCTION public.company_asset_limit(_company uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN s.id IS NULL OR s.status NOT IN ('active','read_only') OR pl.id IS NULL OR pl.asset_limit IS NULL THEN NULL
    ELSE pl.asset_limit + COALESCE((SELECT sum(coalesce(k.asset_limit,0)) FROM public.platform_catalog k WHERE k.id = ANY(s.pack_ids)),0)::int END
  FROM (SELECT 1) x
  LEFT JOIN public.platform_subscriptions s ON s.company_id=_company AND s.product_id=public.company_app_product_id()
  LEFT JOIN public.platform_catalog pl ON pl.id=s.plan_id
$$;
REVOKE EXECUTE ON FUNCTION public.company_asset_limit(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.guard_asset_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lim integer := public.company_asset_limit(NEW.company_id);
BEGIN
  IF lim IS NOT NULL AND (SELECT count(*) FROM public.assets WHERE company_id=NEW.company_id) >= lim THEN
    RAISE EXCEPTION 'Your plan includes % equipment records. Add an asset pack or upgrade to add more.', lim;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assets_guard_limit ON public.assets;
CREATE TRIGGER assets_guard_limit BEFORE INSERT ON public.assets FOR EACH ROW EXECUTE FUNCTION public.guard_asset_limit();