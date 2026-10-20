DROP POLICY IF EXISTS products_read ON public.platform_products;
CREATE POLICY products_read ON public.platform_products FOR SELECT TO authenticated USING (active OR public.is_platform_owner());