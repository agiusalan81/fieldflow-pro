BEGIN;
DO $$
DECLARE p uuid; item record;
BEGIN
 SELECT id INTO p FROM public.platform_products WHERE slug='fieldbridge';
 IF (SELECT count(*) FROM public.platform_catalog WHERE product_id=p AND kind='plan' AND name IN ('Basic','Plus','Pro','Enterprise'))<>4 THEN RAISE EXCEPTION 'Four agreed tiers required'; END IF;
 IF (SELECT count(*) FROM public.platform_catalog WHERE product_id=p AND kind='pack' AND name IN ('Bronze','Silver','Gold','Diamond'))<>4 THEN RAISE EXCEPTION 'Four agreed packs required'; END IF;
 FOR item IN SELECT * FROM public.platform_catalog WHERE product_id=p AND kind='plan' AND name IN ('Basic','Plus','Pro','Enterprise') LOOP
  IF NOT 'branding_basic'=ANY(item.modules) THEN RAISE EXCEPTION 'Basic branding required in %',item.name; END IF;
  IF item.name='Basic' AND 'custom_app_title'=ANY(item.modules) THEN RAISE EXCEPTION 'Basic must retain FieldBridge title'; END IF;
  IF item.name<>'Basic' AND NOT 'custom_app_title'=ANY(item.modules) THEN RAISE EXCEPTION '% must unlock title',item.name; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.platform_catalog WHERE product_id=p AND name='Pro' AND 'branding_documents'=ANY(modules)) THEN RAISE EXCEPTION 'Pro must include Document Studio'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_catalog WHERE product_id=p AND name='Bronze' AND 'branding_documents'=ANY(modules) AND 'branding_custom_fonts'=ANY(modules) AND 'client_presentation'=ANY(modules)) THEN RAISE EXCEPTION 'Bronze must include document, font and presentation features'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_catalog WHERE product_id=p AND kind='pack' AND included_seats<>0) THEN RAISE EXCEPTION 'Packs must not require more seats'; END IF;
 BEGIN
  PERFORM public.set_catalog_module((SELECT id FROM public.platform_catalog WHERE product_id=p AND name='Bronze'),'fleet_management',true);
  RAISE EXCEPTION 'Unauthorized catalog change succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 WHEN raise_exception THEN IF SQLERRM<>'Platform-owner access required' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
