CREATE TABLE public.platform_company_controls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
 is_test boolean NOT NULL DEFAULT false,
 location_city text NOT NULL DEFAULT '',
 location_country text NOT NULL DEFAULT '',
 internal_notes text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_company_controls TO authenticated;
GRANT ALL ON public.platform_company_controls TO service_role;
ALTER TABLE public.platform_company_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY controls_owner_read ON public.platform_company_controls FOR SELECT TO authenticated USING (public.is_platform_owner());
CREATE TRIGGER platform_audit AFTER INSERT OR UPDATE OR DELETE ON public.platform_company_controls FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();

CREATE TABLE public.platform_legal_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL UNIQUE REFERENCES public.platform_products(id),
 legal_name text NOT NULL DEFAULT '',
 registration_number text NOT NULL DEFAULT '',
 vat_number text NOT NULL DEFAULT '',
 registered_address text NOT NULL DEFAULT '',
 country text NOT NULL DEFAULT '',
 sales_email text NOT NULL DEFAULT '',
 support_email text NOT NULL DEFAULT '',
 billing_email text NOT NULL DEFAULT '',
 privacy_email text NOT NULL DEFAULT '',
 founder_name text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT legal_profile_lengths CHECK (length(legal_name)<=200 AND length(registration_number)<=100 AND length(vat_number)<=100 AND length(registered_address)<=2000 AND length(country)<=100 AND length(sales_email)<=254 AND length(support_email)<=254 AND length(billing_email)<=254 AND length(privacy_email)<=254 AND length(founder_name)<=200)
);
GRANT SELECT, INSERT, UPDATE ON public.platform_legal_profiles TO authenticated;
GRANT ALL ON public.platform_legal_profiles TO service_role;
ALTER TABLE public.platform_legal_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_profiles_owner ON public.platform_legal_profiles FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE TRIGGER platform_audit AFTER INSERT OR UPDATE OR DELETE ON public.platform_legal_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();

CREATE FUNCTION public.platform_subscription_module_access(_subscription uuid, _module text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.platform_subscriptions; p public.platform_products; o boolean;
BEGIN
 SELECT * INTO s FROM public.platform_subscriptions WHERE id=_subscription;
 IF NOT FOUND THEN RETURN false; END IF;
 IF s.status='legacy' THEN RETURN true; END IF;
 IF s.status='trial' AND s.trial_ends_at<=now() THEN RETURN false; END IF;
 IF s.status NOT IN ('trial','active') THEN RETURN false; END IF;
 IF public.company_invoice_lapsed(s.id) THEN RETURN false; END IF;
 IF _module='core' THEN RETURN true; END IF;
 SELECT enabled INTO o FROM public.platform_overrides WHERE subscription_id=s.id AND module=_module AND starts_at<=now() AND ends_at>now() ORDER BY created_at DESC,id DESC LIMIT 1;
 IF FOUND THEN RETURN o; END IF;
 IF s.status='trial' THEN RETURN true; END IF;
 SELECT * INTO p FROM public.platform_products WHERE id=s.product_id;
 IF NOT (_module=ANY(p.modules)) THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.platform_catalog c WHERE c.product_id=s.product_id AND (c.id=s.plan_id OR c.id=ANY(s.pack_ids)) AND _module=ANY(c.modules));
END $$;
REVOKE ALL ON FUNCTION public.platform_subscription_module_access(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_subscription_module_access(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.company_module_access(_company uuid,_module text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; state text;
BEGIN
 SELECT id,status INTO sid,state FROM public.platform_subscriptions WHERE company_id=_company AND product_id=public.company_app_product_id() LIMIT 1;
 IF NOT FOUND OR state='legacy' THEN RETURN true; END IF;
 RETURN public.platform_subscription_module_access(sid,_module);
END $$;

CREATE OR REPLACE FUNCTION public.my_commercial_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.platform_subscriptions; p public.platform_products;
BEGIN
 SELECT * INTO p FROM public.platform_products WHERE id=public.company_app_product_id();
 SELECT * INTO s FROM public.platform_subscriptions WHERE company_id=public.current_company_id() AND product_id=p.id LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','legacy','writable',true,'modules','[]'::jsonb); END IF;
 RETURN jsonb_build_object('state',CASE WHEN s.status='trial' AND s.trial_ends_at<=now() THEN 'read_only' WHEN s.status IN ('trial','active') AND public.company_invoice_lapsed(s.id) THEN 'read_only' ELSE s.status END,'invoice_lapsed',public.company_invoice_lapsed(s.id),'trial_ends_at',s.trial_ends_at,'writable',public.company_module_access(s.company_id,'core'),'modules',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',m,'enabled',public.company_module_access(s.company_id,m))),'[]'::jsonb) FROM (SELECT unnest(p.modules) m UNION SELECT module FROM public.platform_overrides WHERE subscription_id=s.id) listed),'branding',(SELECT branding_required FROM public.platform_catalog WHERE id=s.plan_id));
END $$;

CREATE FUNCTION public.platform_hq_directory() RETURNS TABLE(id uuid,name text,user_count bigint,city text,country text,address text,contact_email text,is_test boolean,internal_notes text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 RETURN QUERY SELECT c.id,c.name,(SELECT count(*) FROM public.users u WHERE u.company_id=c.id),coalesce(nullif(pc.location_city,''),cs.office_address->>'city',''),coalesce(pc.location_country,''),coalesce(nullif(concat_ws(', ',nullif(cs.office_address->>'building',''),nullif(cs.office_address->>'street',''),nullif(cs.office_address->>'city',''),nullif(cs.office_address->>'postalCode','')),''),cs.company_address,''),coalesce(cs.company_email,''),coalesce(pc.is_test,false),coalesce(pc.internal_notes,'') FROM public.companies c LEFT JOIN public.company_settings cs ON cs.company_id=c.id LEFT JOIN public.platform_company_controls pc ON pc.company_id=c.id ORDER BY c.name;
END $$;
REVOKE ALL ON FUNCTION public.platform_hq_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_hq_directory() TO authenticated,service_role;

CREATE FUNCTION public.platform_hq_module_status() RETURNS TABLE(subscription_id uuid,module text,enabled boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 RETURN QUERY SELECT s.id,m.name,public.platform_subscription_module_access(s.id,m.name) FROM public.platform_subscriptions s JOIN public.platform_products p ON p.id=s.product_id CROSS JOIN LATERAL (SELECT unnest(p.modules) name UNION SELECT o.module FROM public.platform_overrides o WHERE o.subscription_id=s.id UNION SELECT 'core') m;
END $$;
REVOKE ALL ON FUNCTION public.platform_hq_module_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_hq_module_status() TO authenticated,service_role;

CREATE FUNCTION public.platform_save_company_controls(_company uuid,_test boolean,_city text,_country text,_notes text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF length(_city)>200 OR length(_country)>100 OR length(_notes)>5000 OR _city IS NULL OR _country IS NULL OR _notes IS NULL OR _test IS NULL THEN RAISE EXCEPTION 'Invalid company details'; END IF;
 PERFORM 1 FROM public.companies WHERE id=_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company not found'; END IF;
 INSERT INTO public.platform_company_controls(company_id,is_test,location_city,location_country,internal_notes) VALUES(_company,_test,btrim(_city),btrim(_country),_notes) ON CONFLICT(company_id) DO UPDATE SET is_test=excluded.is_test,location_city=excluded.location_city,location_country=excluded.location_country,internal_notes=excluded.internal_notes,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.platform_save_company_controls(uuid,boolean,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_save_company_controls(uuid,boolean,text,text,text) TO authenticated,service_role;

CREATE FUNCTION public.platform_set_company_module(_subscription uuid,_module text,_mode text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.platform_subscriptions;
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 SELECT * INTO s FROM public.platform_subscriptions WHERE id=_subscription FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
 IF _module='core' OR _module IS NULL OR length(_module)>100 OR _mode IS NULL OR _mode NOT IN ('package','on','off') OR NOT EXISTS(SELECT 1 FROM public.platform_products WHERE id=s.product_id AND _module=ANY(modules)) THEN RAISE EXCEPTION 'Invalid optional module'; END IF;
 DELETE FROM public.platform_overrides WHERE subscription_id=s.id AND module=_module AND reason IN ('Setup package','Company access');
 IF _mode<>'package' THEN INSERT INTO public.platform_overrides(subscription_id,module,enabled,starts_at,ends_at,reason) VALUES(s.id,_module,_mode='on',now(),'2099-12-31T23:59:59Z','Company access'); END IF;
END $$;
REVOKE ALL ON FUNCTION public.platform_set_company_module(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_set_company_module(uuid,text,text) TO authenticated,service_role;