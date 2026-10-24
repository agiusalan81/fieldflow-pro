CREATE OR REPLACE FUNCTION public.hq_save_setup_options(_subscription uuid, _options jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.platform_subscriptions; module text; mode text; modes jsonb; immediate boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_platform_owner() OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Active platform owner required'; END IF;
 SELECT * INTO s FROM public.platform_subscriptions WHERE id=_subscription FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription unavailable'; END IF;
 IF _options IS NULL OR jsonb_typeof(_options)<>'object' OR jsonb_typeof(_options->'modes') IS DISTINCT FROM 'object' OR jsonb_typeof(_options->'coming_soon') IS DISTINCT FROM 'array' OR jsonb_typeof(_options->'hide_locked') IS DISTINCT FROM 'boolean' OR jsonb_typeof(_options->'immediate') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid setup options'; END IF;
 modes:=_options->'modes'; immediate:=(_options->>'immediate')::boolean;
 FOR module,mode IN SELECT key,value FROM jsonb_each_text(modes) LOOP
  IF module !~ '^[a-z][a-z0-9_]{0,99}$' OR mode NOT IN('on','off','package') OR (module='core' AND mode='off') THEN RAISE EXCEPTION 'Invalid module selection'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(_options->'coming_soon') m WHERE m !~ '^[a-z][a-z0-9_]{0,99}$' OR NOT modes ? m) THEN RAISE EXCEPTION 'Invalid coming soon selection'; END IF;
 UPDATE public.platform_products SET modules=ARRAY(SELECT DISTINCT m FROM unnest(modules || ARRAY(SELECT jsonb_object_keys(modes))) m ORDER BY m) WHERE id=s.product_id;
 IF immediate THEN
  PERFORM public.hq_apply_setup_now(s.id, nullif(_options->>'plan','')::uuid, ARRAY(SELECT jsonb_array_elements_text(_options->'packs')::uuid), (_options->>'seats')::integer, _options->>'cadence', (_options->>'price')::numeric, modes);
 ELSE
  DELETE FROM public.platform_overrides WHERE subscription_id=s.id AND reason='Setup package';
  FOR module,mode IN SELECT key,value FROM jsonb_each_text(modes) LOOP
   IF module<>'core' AND mode<>'package' THEN INSERT INTO public.platform_overrides(subscription_id,module,enabled,starts_at,ends_at,reason) VALUES(s.id,module,mode='on',now(),'2099-12-31T23:59:59Z','Setup package'); END IF;
  END LOOP;
 END IF;
 UPDATE public.platform_subscriptions SET hide_locked_modules=(_options->>'hide_locked')::boolean, coming_soon_modules=ARRAY(SELECT DISTINCT jsonb_array_elements_text(_options->'coming_soon')) WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.hq_save_setup_options(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hq_save_setup_options(uuid,jsonb) TO authenticated;