CREATE TABLE public.platform_module_roadmap (
  product_id uuid NOT NULL REFERENCES public.platform_products(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module ~ '^[a-z0-9_]{1,60}$'),
  targeted boolean NOT NULL DEFAULT false,
  release_target text NOT NULL DEFAULT '' CHECK (char_length(release_target) <= 40),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_module_roadmap TO authenticated;
GRANT ALL ON public.platform_module_roadmap TO service_role;
ALTER TABLE public.platform_module_roadmap ENABLE ROW LEVEL SECURITY;
CREATE POLICY roadmap_owner ON public.platform_module_roadmap FOR ALL TO authenticated
  USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());