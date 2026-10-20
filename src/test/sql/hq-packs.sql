BEGIN;
DO $$
DECLARE p uuid; c uuid; s uuid; basic uuid; plus uuid; pro uuid; bronze uuid; owner_id uuid; pack_modules text[];
BEGIN
 SELECT id INTO p FROM public.platform_products WHERE slug='fieldbridge';
 IF (SELECT count(*) FROM public.platform_catalog WHERE product_id=p AND kind='plan' AND name IN ('Basic','Plus','Pro','Enterprise'))<>4 THEN RAISE EXCEPTION 'Four tiers required'; END IF;
 IF (SELECT count(*) FROM public.platform_catalog WHERE product_id=p AND kind='pack' AND name IN ('Bronze','Silver','Gold','Diamond'))<>4 THEN RAISE EXCEPTION 'Four packs required'; END IF;
 SELECT id INTO basic FROM public.platform_catalog WHERE product_id=p AND name='Basic' AND kind='plan';
 SELECT id INTO plus FROM public.platform_catalog WHERE product_id=p AND name='Plus' AND kind='plan';
 SELECT id INTO pro FROM public.platform_catalog WHERE product_id=p AND name='Pro' AND kind='plan';
 SELECT id,modules INTO bronze,pack_modules FROM public.platform_catalog WHERE product_id=p AND name='Bronze' AND kind='pack';
 INSERT INTO public.companies(name) VALUES('HQ transactional verification') RETURNING id INTO c;
 UPDATE public.platform_subscriptions SET status='active',plan_id=basic,agreed_price=123,seats=7 WHERE product_id=p AND company_id=c RETURNING id INTO s;
 IF s IS NULL THEN RAISE EXCEPTION 'Company trial subscription missing'; END IF;
 IF public.company_module_access(c,'custom_app_title') THEN RAISE EXCEPTION 'Basic must retain FieldBridge title'; END IF;
 IF NOT public.company_module_access(c,'branding_basic') THEN RAISE EXCEPTION 'Basic branding required'; END IF;
 UPDATE public.platform_subscriptions SET plan_id=plus WHERE id=s;
 IF NOT public.company_module_access(c,'custom_app_title') THEN RAISE EXCEPTION 'Plus must unlock title'; END IF;
 UPDATE public.platform_subscriptions SET plan_id=pro WHERE id=s;
 IF NOT public.company_module_access(c,'branding_documents') THEN RAISE EXCEPTION 'Pro must unlock Document Studio'; END IF;
 UPDATE public.platform_subscriptions SET plan_id=basic WHERE id=s;
 BEGIN
  PERFORM public.set_catalog_module(bronze,'fleet_management',true);
  RAISE EXCEPTION 'Unauthorized catalog change succeeded';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Platform-owner access required' THEN RAISE; END IF; END;
 SELECT user_id INTO owner_id FROM public.user_roles WHERE platform_owner AND registration_status='active' LIMIT 1;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Owner fixture required'; END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 PERFORM public.set_catalog_module(bronze,'fleet_management',true);
 IF NOT EXISTS(SELECT 1 FROM public.platform_catalog WHERE id=bronze AND 'fleet_management'=ANY(modules)) THEN RAISE EXCEPTION 'Matrix must save feature'; END IF;
 PERFORM public.set_catalog_module(bronze,'fleet_management',false);
 IF (SELECT modules FROM public.platform_catalog WHERE id=bronze) IS DISTINCT FROM ARRAY(SELECT m FROM unnest(pack_modules) m ORDER BY m) THEN RAISE EXCEPTION 'Other features must survive'; END IF;
 BEGIN
  PERFORM public.set_subscription_pack(s,bronze,true);
  RAISE EXCEPTION 'Draft pack assignment succeeded';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Publish this pack before assigning it' THEN RAISE; END IF; END;
 UPDATE public.platform_catalog SET state='active' WHERE id=bronze;
 PERFORM public.set_subscription_pack(s,bronze,true);
 IF NOT public.company_module_access(c,'branding_documents') THEN RAISE EXCEPTION 'Basic plus Bronze must unlock Document Studio'; END IF;
 IF (SELECT agreed_price<>123 OR seats<>7 OR plan_id<>basic FROM public.platform_subscriptions WHERE id=s) THEN RAISE EXCEPTION 'Pack must preserve price, seats and plan'; END IF;
 PERFORM public.set_subscription_pack(s,bronze,false);
 IF public.company_module_access(c,'branding_documents') THEN RAISE EXCEPTION 'Removing Bronze must remove its entitlement'; END IF;
END $$;
ROLLBACK;