GRANT SELECT ON public.platform_catalog TO anon;
CREATE POLICY catalog_public_read ON public.platform_catalog FOR SELECT TO anon USING (state = 'active');