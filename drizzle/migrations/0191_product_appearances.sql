CREATE TABLE public.product_appearances (
  edition text PRIMARY KEY CHECK (edition IN ('contractor','hotel','retail')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_appearances TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_appearances TO authenticated;
GRANT ALL ON public.product_appearances TO service_role;
ALTER TABLE public.product_appearances ENABLE ROW LEVEL SECURITY;
CREATE POLICY appearances_read ON public.product_appearances FOR SELECT TO authenticated USING (true);
CREATE POLICY appearances_manage ON public.product_appearances FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner() AND jsonb_typeof(settings)='object');