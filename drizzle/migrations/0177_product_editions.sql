ALTER TABLE public.platform_products ADD COLUMN IF NOT EXISTS engine_edition text CHECK (engine_edition IS NULL OR engine_edition IN ('contractor','hotel','retail'));
UPDATE public.platform_products SET engine_edition='contractor' WHERE slug='fieldbridge' AND engine_edition IS NULL;

CREATE OR REPLACE FUNCTION public.company_product_id(_company uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT coalesce((SELECT s.product_id FROM public.platform_subscriptions s JOIN public.platform_products p ON p.id=s.product_id WHERE s.company_id=_company AND p.engine_edition IS NOT NULL ORDER BY s.created_at LIMIT 1), public.company_app_product_id()) $$;
REVOKE ALL ON FUNCTION public.company_product_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_product_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.company_module_access(_company uuid, _module text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE sid uuid; state text; BEGIN SELECT id,status INTO sid,state FROM public.platform_subscriptions WHERE company_id=_company AND product_id=public.company_product_id(_company) LIMIT 1; IF NOT FOUND OR state='legacy' THEN RETURN true; END IF; RETURN public.platform_subscription_module_access(sid,CASE WHEN _module IN('customer_quotes','contracts') THEN 'core' ELSE _module END); END $$;

CREATE OR REPLACE FUNCTION public.company_asset_limit(_company uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN s.id IS NULL OR s.status NOT IN ('active','read_only') OR pl.id IS NULL OR pl.asset_limit IS NULL THEN NULL
    ELSE pl.asset_limit + COALESCE((SELECT sum(coalesce(k.asset_limit,0)) FROM public.platform_catalog k WHERE k.id = ANY(s.pack_ids)),0)::int END
  FROM (SELECT 1) x
  LEFT JOIN public.platform_subscriptions s ON s.company_id=_company AND s.product_id=public.company_product_id(_company)
  LEFT JOIN public.platform_catalog pl ON pl.id=s.plan_id $$;

CREATE OR REPLACE FUNCTION public.company_email_branding(_company uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE mode text; BEGIN
 IF auth.uid() IS NULL OR _company IS DISTINCT FROM public.current_company_id() OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Active company membership required'; END IF;
 SELECT email_branding_mode INTO mode FROM public.platform_subscriptions WHERE company_id=_company AND product_id=public.company_product_id(_company) LIMIT 1;
 IF mode='off' THEN RETURN false; END IF;
 IF mode='on' THEN RETURN true; END IF;
 RETURN public.company_module_access(_company,'client_presentation'); END $$;

CREATE OR REPLACE FUNCTION public.branding_offers() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.name,'kind',c.kind,'modules',c.modules,'state',c.state)),'[]'::jsonb) FROM public.platform_catalog c WHERE c.product_id=public.company_product_id(public.current_company_id()) AND c.state='active' AND public.member_is_active(auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.my_commercial_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE s public.platform_subscriptions; p public.platform_products; BEGIN
 SELECT * INTO p FROM public.platform_products WHERE id=public.company_product_id(public.current_company_id());
 SELECT * INTO s FROM public.platform_subscriptions WHERE company_id=public.current_company_id() AND product_id=p.id LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','legacy','writable',true,'modules','[]'::jsonb,'edition',coalesce(p.engine_edition,'contractor'),'product_name',p.name); END IF;
 RETURN jsonb_build_object('edition',coalesce(p.engine_edition,'contractor'),'product_name',p.name,'state',CASE WHEN s.status='trial' AND s.trial_ends_at<=now() THEN 'read_only' WHEN s.status IN ('trial','active') AND public.company_invoice_lapsed(s.id) THEN 'read_only' ELSE s.status END,'subscription_status',s.status,'plan_id',s.plan_id,'pack_ids',s.pack_ids,'cadence',s.cadence,'seats',s.seats,'agreed_price',s.agreed_price,'trial_package_only',s.trial_package_only,'pending_change',s.pending_change,'invoice_lapsed',public.company_invoice_lapsed(s.id),'trial_ends_at',s.trial_ends_at,'writable',public.company_module_access(s.company_id,'core'),'hide_locked_modules',s.hide_locked_modules,'hidden_modules',s.hidden_modules,'coming_soon_modules',s.coming_soon_modules,'modules',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',m,'enabled',public.company_module_access(s.company_id,m))),'[]'::jsonb) FROM (SELECT unnest(p.modules) m UNION SELECT module FROM public.platform_overrides WHERE subscription_id=s.id) listed),'branding',(SELECT branding_required FROM public.platform_catalog WHERE id=s.plan_id));
END $$;

CREATE OR REPLACE FUNCTION public.platform_create_company(_product uuid, _name text, _test boolean, _plan uuid DEFAULT NULL::uuid, _cadence text DEFAULT 'monthly'::text, _price numeric DEFAULT 0, _seats integer DEFAULT 4, _packs uuid[] DEFAULT '{}'::uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE co uuid; s uuid; pr public.platform_products; actor uuid=auth.uid(); jwt text=current_setting('request.jwt.claims',true); sub text=current_setting('request.jwt.claim.sub',true);
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF _name IS NULL OR length(btrim(_name)) NOT BETWEEN 1 AND 200 OR _test IS NULL OR _cadence NOT IN ('monthly','quarterly','yearly') OR _price IS NULL OR _price<0 OR _seats IS NULL OR _seats<1 OR _packs IS NULL THEN RAISE EXCEPTION 'Invalid company details'; END IF;
 SELECT * INTO pr FROM public.platform_products WHERE id=_product AND active AND engine_edition IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Use registration in the selected external product'; END IF;
 IF _plan IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.platform_catalog WHERE id=_plan AND product_id=_product AND kind='plan' AND state='active') THEN RAISE EXCEPTION 'Choose an active plan for this product'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_packs) x WHERE NOT EXISTS(SELECT 1 FROM public.platform_catalog c WHERE c.id=x AND c.product_id=_product AND c.kind='pack' AND c.state='active')) THEN RAISE EXCEPTION 'Choose active packs for this product'; END IF;
 INSERT INTO public.companies(name) VALUES(btrim(_name)) RETURNING id INTO co;
 PERFORM set_config('request.jwt.claims','',true); PERFORM set_config('request.jwt.claim.sub','',true); INSERT INTO public.company_settings(company_id) VALUES(co) ON CONFLICT(company_id) DO NOTHING; PERFORM set_config('request.jwt.claims',coalesce(jwt,''),true); PERFORM set_config('request.jwt.claim.sub',coalesce(sub,''),true);
 INSERT INTO public.platform_company_controls(company_id,is_test) VALUES(co,_test);
 UPDATE public.platform_subscriptions SET product_id=_product, trial_ends_at=now()+make_interval(days=>pr.trial_days) WHERE company_id=co AND product_id<>_product AND product_id IN (SELECT id FROM public.platform_products WHERE engine_edition IS NOT NULL);
 SELECT id INTO s FROM public.platform_subscriptions WHERE company_id=co AND product_id=_product FOR UPDATE;
 IF s IS NULL THEN INSERT INTO public.platform_subscriptions(product_id,company_id,tenant_name,status) VALUES(_product,co,btrim(_name),'trial') RETURNING id INTO s; END IF;
 UPDATE public.platform_subscriptions SET plan_id=_plan,cadence=_cadence,agreed_price=_price,seats=_seats,pack_ids=_packs WHERE id=s;
 INSERT INTO public.platform_audit(actor_id,entity,entity_id,action,after_value) VALUES(auth.uid(),'company_setup',co,'CREATE',jsonb_build_object('product_id',_product,'is_test',_test));
 RETURN co;
END $$;

CREATE OR REPLACE FUNCTION public.platform_initial_superuser_invite(_company uuid, _email text DEFAULT NULL::text, _name text DEFAULT NULL::text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i public.company_invites; p public.platform_products;
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 PERFORM 1 FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE company_id=_company AND role='superuser' AND registration_status='active') THEN RAISE EXCEPTION 'This company already has an active Superuser. Use Team invitations in its workspace.'; END IF;
 IF _email IS NOT NULL AND (length(_email)>254 OR btrim(_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Enter a valid email'; END IF;
 IF length(coalesce(_name,''))>200 THEN RAISE EXCEPTION 'Name is too long'; END IF;
 SELECT * INTO p FROM public.platform_products WHERE id=public.company_product_id(_company) AND active;
 IF NOT EXISTS(SELECT 1 FROM public.platform_subscriptions WHERE company_id=_company AND product_id=p.id) THEN RAISE EXCEPTION 'Company is not linked to this product'; END IF;
 DELETE FROM public.company_invites WHERE company_id=_company AND role='superuser' AND used_at IS NULL;
 INSERT INTO public.company_invites(company_id,role,email,full_name,created_by) VALUES(_company,'superuser',nullif(lower(btrim(_email)),''),nullif(btrim(_name),''),auth.uid()) RETURNING * INTO i;
 INSERT INTO public.platform_audit(actor_id,entity,entity_id,action,after_value) VALUES(auth.uid(),'company_invitation',_company,'CREATE',jsonb_build_object('role','superuser','expires_at',i.expires_at));
 RETURN jsonb_build_object('token',i.token,'expires_at',i.expires_at,'app_url',p.app_url);
END $$;