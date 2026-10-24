DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.hq_save_setup_options(uuid,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'modes:=_options->''modes''; immediate:=(_options->>''immediate'')::boolean;', 'modes:=_options->''modes''; immediate:=(_options->>''immediate'')::boolean;
 IF immediate THEN
 IF jsonb_typeof(_options->''packs'') IS DISTINCT FROM ''array'' THEN RAISE EXCEPTION ''Invalid packs''; END IF;
 IF nullif(_options->>''plan'','''') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.platform_catalog WHERE id=(_options->>''plan'')::uuid AND product_id=s.product_id AND kind=''plan'' AND state<>''archived'') THEN RAISE EXCEPTION ''Choose a tier from this product''; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(_options->''packs'') chosen WHERE NOT EXISTS(SELECT 1 FROM public.platform_catalog WHERE id=chosen::uuid AND product_id=s.product_id AND kind=''pack'' AND state<>''archived'')) THEN RAISE EXCEPTION ''Choose packs from this product''; END IF;
 END IF;');
 EXECUTE definition;
END $$;