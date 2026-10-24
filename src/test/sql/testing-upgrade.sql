BEGIN;
DO $$
DECLARE tenant uuid; client uuid; site_a uuid; site_b uuid; contact uuid; actor uuid:=gen_random_uuid(); product uuid; plan uuid; subscription uuid; scope jsonb; workspace jsonb;
BEGIN
 INSERT INTO public.companies(name) VALUES('Rollback-only testing upgrade fixture') RETURNING id INTO tenant;
 INSERT INTO public.clients(company_id,name) VALUES(tenant,'Rollback-only client') RETURNING id INTO client;
 INSERT INTO public.sites(company_id,client_id,name) VALUES(tenant,client,'Site A') RETURNING id INTO site_a;
 INSERT INTO public.sites(company_id,client_id,name) VALUES(tenant,client,'Site B') RETURNING id INTO site_b;
 INSERT INTO public.client_contacts(company_id,client_id,first_name,email,all_sites,site_ids,site_id,delivery_preferences,receives_job_sheets) VALUES(tenant,client,'Site A manager','fixture@example.invalid',false,ARRAY[site_a],site_a,'{"job_sheet":{"email":true,"whatsapp":false}}',true) RETURNING id INTO contact;
 INSERT INTO public.client_portal_memberships(company_id,client_id,contact_id,user_id,access_role,all_sites,site_ids) VALUES(tenant,client,contact,actor,'client_admin',false,ARRAY[site_a]);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 workspace:=public.client_workspace(client);
 IF jsonb_array_length(workspace->'sites')<>1 OR workspace->'sites'->0->>'id'<>site_a::text THEN RAISE EXCEPTION 'Portal leaked unrelated sites'; END IF;
 BEGIN
 PERFORM public.save_client_contact(client,contact,jsonb_build_object('first_name','Unauthorized expansion','email','fixture@example.invalid','all_sites',false,'site_ids',jsonb_build_array(site_b),'delivery_preferences','{"job_sheet":{"email":true,"whatsapp":false}}'::jsonb,'has_whatsapp',false));
 RAISE EXCEPTION 'Expanded site scope accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Expanded site scope accepted' THEN RAISE; END IF; END;
 UPDATE public.client_portal_memberships SET revoked_at=now() WHERE user_id=actor;
 BEGIN
 PERFORM public.client_workspace(client); RAISE EXCEPTION 'Revoked client access accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Revoked client access accepted' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub','',true);
 SELECT public.company_app_product_id() INTO product;
 INSERT INTO public.platform_catalog(product_id,name,kind,modules) VALUES(product,'Rollback-only Basic tier','plan',ARRAY['core']) RETURNING id INTO plan;
 INSERT INTO public.platform_subscriptions(product_id,company_id,status,plan_id,trial_package_only) VALUES(product,tenant,'trial',plan,false) RETURNING id INTO subscription;
 IF NOT public.platform_subscription_module_access(subscription,'payroll') THEN RAISE EXCEPTION 'Full trial unexpectedly restricted'; END IF;
 UPDATE public.platform_subscriptions SET trial_package_only=true WHERE id=subscription;
 IF public.platform_subscription_module_access(subscription,'payroll') THEN RAISE EXCEPTION 'Immediate Basic trial retained payroll'; END IF;
 IF NOT public.platform_subscription_module_access(subscription,'core') THEN RAISE EXCEPTION 'Immediate Basic lost core'; END IF;
 UPDATE public.platform_subscriptions SET trial_package_only=false WHERE id=subscription;
 IF NOT public.platform_subscription_module_access(subscription,'payroll') THEN RAISE EXCEPTION 'Normal full-trial mode not restored'; END IF;
 BEGIN
 PERFORM public.hq_apply_setup_now(subscription,plan,'{}',4,'monthly',89,'{}'); RAISE EXCEPTION 'Unsigned HQ change accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unsigned HQ change accepted' THEN RAISE; END IF; END;
 RAISE NOTICE 'Portal site isolation, revocation and immediate trial entitlement checks passed';
END $$;
ROLLBACK;