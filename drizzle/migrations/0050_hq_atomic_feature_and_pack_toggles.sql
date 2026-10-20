CREATE OR REPLACE FUNCTION public.set_catalog_module(_catalog uuid, _module text, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE c public.platform_catalog;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_platform_owner() OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF _enabled IS NULL OR nullif(trim(_module),'') IS NULL THEN RAISE EXCEPTION 'Choose a feature and its state'; END IF;
 SELECT * INTO c FROM public.platform_catalog WHERE id=_catalog FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Catalog item unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_products WHERE id=c.product_id AND _module=ANY(modules)) THEN RAISE EXCEPTION 'Feature is not sold in this product'; END IF;
 IF c.kind='plan' AND _module='core' AND NOT _enabled THEN RAISE EXCEPTION 'Core is included in every tier'; END IF;
 UPDATE public.platform_catalog SET modules=CASE WHEN _enabled THEN ARRAY(SELECT DISTINCT m FROM unnest(c.modules || ARRAY[_module]) m ORDER BY m) ELSE array_remove(c.modules,_module) END WHERE id=c.id;
END $$;
REVOKE ALL ON FUNCTION public.set_catalog_module(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_catalog_module(uuid,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_subscription_pack(_subscription uuid, _pack uuid, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s public.platform_subscriptions; c public.platform_catalog;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_platform_owner() OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF _enabled IS NULL THEN RAISE EXCEPTION 'Choose a pack state'; END IF;
 SELECT * INTO s FROM public.platform_subscriptions WHERE id=_subscription FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription unavailable'; END IF;
 SELECT * INTO c FROM public.platform_catalog WHERE id=_pack AND product_id=s.product_id AND kind='pack';
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a pack from the same product'; END IF;
 IF _enabled AND c.state<>'active' THEN RAISE EXCEPTION 'Publish this pack before assigning it'; END IF;
 UPDATE public.platform_subscriptions SET pack_ids=CASE WHEN _enabled THEN ARRAY(SELECT DISTINCT p FROM unnest(s.pack_ids || ARRAY[_pack]) p ORDER BY p) ELSE array_remove(s.pack_ids,_pack) END WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.set_subscription_pack(uuid,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_subscription_pack(uuid,uuid,boolean) TO authenticated;