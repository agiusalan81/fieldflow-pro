BEGIN;
DO $$
DECLARE c uuid; s uuid; p uuid; deadline timestamptz; m text;
BEGIN
 SELECT id INTO p FROM public.platform_products WHERE slug='fieldbridge';
 IF p IS NULL THEN RAISE EXCEPTION 'FieldBridge product missing'; END IF;
 INSERT INTO public.companies(name) VALUES('FieldBridge transactional test') RETURNING id INTO c;
 SELECT id,trial_ends_at INTO s,deadline FROM public.platform_subscriptions WHERE company_id=c AND product_id=p;
 IF s IS NULL OR deadline IS DISTINCT FROM now()+interval '60 days' THEN RAISE EXCEPTION 'Signup must start a 60-day trial'; END IF;
 FOREACH m IN ARRAY ARRAY['core','tracking','receipts','technical_library','standby','estimates','supplier_email','contracts','payroll','safety','reports','digitization'] LOOP
  IF NOT public.company_module_access(c,m) THEN RAISE EXCEPTION 'Full trial missing %',m; END IF;
 END LOOP;
 UPDATE public.platform_subscriptions SET trial_ends_at=now()-interval '1 second' WHERE id=s;
 IF public.company_module_access(c,'core') THEN RAISE EXCEPTION 'Expired trial must block writes'; END IF;
 UPDATE public.platform_subscriptions SET status='legacy' WHERE id=s;
 IF NOT public.company_module_access(c,'payroll') THEN RAISE EXCEPTION 'Legacy access must survive expiration'; END IF;
 UPDATE public.platform_subscriptions SET status='active' WHERE id=s;
 IF public.company_module_access(c,'payroll') THEN RAISE EXCEPTION 'Active subscription needs payroll entitlement'; END IF;
 INSERT INTO public.platform_overrides(subscription_id,module,enabled,starts_at,ends_at) VALUES(s,'payroll',true,now()-interval '1 day',now()+interval '1 day');
 IF NOT public.company_module_access(c,'payroll') THEN RAISE EXCEPTION 'Live promotion must grant payroll'; END IF;
 UPDATE public.platform_overrides SET ends_at=now()-interval '1 second' WHERE subscription_id=s;
 IF public.company_module_access(c,'payroll') THEN RAISE EXCEPTION 'Expired promotion must not grant payroll'; END IF;
END $$;
ROLLBACK;
