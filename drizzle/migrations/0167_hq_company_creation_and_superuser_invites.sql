CREATE OR REPLACE FUNCTION public.platform_create_company(_product uuid,_name text,_test boolean,_plan uuid DEFAULT NULL,_cadence text DEFAULT 'monthly',_price numeric DEFAULT 0,_seats integer DEFAULT 4,_packs uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE co uuid; s uuid;
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF _name IS NULL OR length(btrim(_name)) NOT BETWEEN 1 AND 200 OR _test IS NULL OR _cadence NOT IN ('monthly','quarterly','yearly') OR _price IS NULL OR _price<0 OR _seats IS NULL OR _seats<1 OR _packs IS NULL THEN RAISE EXCEPTION 'Invalid company details'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.platform_products WHERE id=_product AND active AND id=public.company_app_product_id()) THEN RAISE EXCEPTION 'Use registration in the selected external product'; END IF;
 IF _plan IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.platform_catalog WHERE id=_plan AND product_id=_product AND kind='plan' AND state='active') THEN RAISE EXCEPTION 'Choose an active plan for this product'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_packs) x WHERE NOT EXISTS(SELECT 1 FROM public.platform_catalog c WHERE c.id=x AND c.product_id=_product AND c.kind='pack' AND c.state='active')) THEN RAISE EXCEPTION 'Choose active packs for this product'; END IF;
 INSERT INTO public.companies(name) VALUES(btrim(_name)) RETURNING id INTO co;
 INSERT INTO public.company_settings(company_id) VALUES(co) ON CONFLICT(company_id) DO NOTHING;
 INSERT INTO public.platform_company_controls(company_id,is_test) VALUES(co,_test);
 SELECT id INTO s FROM public.platform_subscriptions WHERE company_id=co AND product_id=_product FOR UPDATE;
 IF s IS NULL THEN RAISE EXCEPTION 'Company trial could not be created'; END IF;
 UPDATE public.platform_subscriptions SET plan_id=_plan,cadence=_cadence,agreed_price=_price,seats=_seats,pack_ids=_packs WHERE id=s;
 INSERT INTO public.platform_audit(actor_id,entity,entity_id,action,after_value) VALUES(auth.uid(),'company_setup',co,'CREATE',jsonb_build_object('product_id',_product,'is_test',_test));
 RETURN co;
END $$;
REVOKE ALL ON FUNCTION public.platform_create_company(uuid,text,boolean,uuid,text,numeric,integer,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_create_company(uuid,text,boolean,uuid,text,numeric,integer,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.platform_initial_superuser_invite(_company uuid,_email text DEFAULT NULL,_name text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.company_invites; p public.platform_products;
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 PERFORM 1 FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE company_id=_company AND role='superuser' AND registration_status='active') THEN RAISE EXCEPTION 'This company already has an active Superuser. Use Team invitations in its workspace.'; END IF;
 IF _email IS NOT NULL AND (length(_email)>254 OR btrim(_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Enter a valid email'; END IF;
 IF length(coalesce(_name,''))>200 THEN RAISE EXCEPTION 'Name is too long'; END IF;
 SELECT * INTO p FROM public.platform_products WHERE id=public.company_app_product_id() AND active;
 IF NOT EXISTS(SELECT 1 FROM public.platform_subscriptions WHERE company_id=_company AND product_id=p.id) THEN RAISE EXCEPTION 'Company is not linked to this product'; END IF;
 DELETE FROM public.company_invites WHERE company_id=_company AND role='superuser' AND used_at IS NULL;
 INSERT INTO public.company_invites(company_id,role,email,full_name,created_by) VALUES(_company,'superuser',nullif(lower(btrim(_email)),''),nullif(btrim(_name),''),auth.uid()) RETURNING * INTO i;
 INSERT INTO public.platform_audit(actor_id,entity,entity_id,action,after_value) VALUES(auth.uid(),'company_invitation',_company,'CREATE',jsonb_build_object('role','superuser','expires_at',i.expires_at));
 RETURN jsonb_build_object('token',i.token,'expires_at',i.expires_at,'app_url',p.app_url);
END $$;
REVOKE ALL ON FUNCTION public.platform_initial_superuser_invite(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_initial_superuser_invite(uuid,text,text) TO authenticated;