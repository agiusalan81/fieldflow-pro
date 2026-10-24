-- Rollback-only regression fixture; no client or account data survives.
DO $$
DECLARE tenant uuid; client uuid; site_a uuid; site_b uuid; contact uuid; actor uuid:=gen_random_uuid(); details jsonb; added uuid;
BEGIN
 BEGIN
  INSERT INTO public.companies(name) VALUES('Rollback-only portal regression') RETURNING id INTO tenant;
  INSERT INTO public.clients(company_id,name) VALUES(tenant,'Regression client') RETURNING id INTO client;
  INSERT INTO public.sites(company_id,client_id,name) VALUES(tenant,client,'A') RETURNING id INTO site_a;
  INSERT INTO public.sites(company_id,client_id,name) VALUES(tenant,client,'B') RETURNING id INTO site_b;
  INSERT INTO public.client_contacts(company_id,client_id,first_name,email,all_sites,site_ids,site_id,has_whatsapp,delivery_preferences)
  VALUES(tenant,client,'Contact','fixture@example.invalid',false,ARRAY[site_a],site_a,false,'{"job_sheet":{"email":true,"whatsapp":false}}') RETURNING id INTO contact;
  INSERT INTO public.client_portal_memberships(company_id,client_id,contact_id,user_id,access_role,all_sites,site_ids)
  VALUES(tenant,client,contact,actor,'client_admin',false,ARRAY[site_a]);
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  details:=jsonb_build_object('first_name','Updated','email','fixture@example.invalid','has_whatsapp',false,'all_sites',false,'site_ids',jsonb_build_array(site_a),'delivery_preferences','{"job_sheet":{"email":false,"whatsapp":false}}'::jsonb);
  PERFORM public.save_client_contact(client,contact,details);
  IF NOT EXISTS(SELECT 1 FROM public.client_contacts WHERE id=contact AND first_name='Updated' AND NOT receives_job_sheets AND site_id=site_a) THEN RAISE EXCEPTION 'Allowed contact/preference edit did not persist'; END IF;
  BEGIN
   PERFORM public.save_client_contact(client,contact,details||jsonb_build_object('site_ids','[]'::jsonb));
   RAISE EXCEPTION 'Site reassignment accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Site reassignment accepted' THEN RAISE; END IF; END;
  BEGIN
   UPDATE public.sites SET name='Unauthorized' WHERE id=site_a;
   RAISE EXCEPTION 'Portal site rename accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Portal site rename accepted' THEN RAISE; END IF; END;
  BEGIN
   INSERT INTO public.sites(company_id,client_id,name) VALUES(tenant,client,'Unauthorized');
   RAISE EXCEPTION 'Portal site creation accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Portal site creation accepted' THEN RAISE; END IF; END;
  BEGIN
   DELETE FROM public.sites WHERE id=site_b;
   RAISE EXCEPTION 'Portal site deletion accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Portal site deletion accepted' THEN RAISE; END IF; END;
  added:=public.save_client_contact(client,NULL,details||jsonb_build_object('first_name','Added'));
  IF NOT EXISTS(SELECT 1 FROM public.client_contacts WHERE id=added AND NOT all_sites AND site_ids=ARRAY[site_a]) THEN RAISE EXCEPTION 'New contact did not inherit portal scope'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  IF EXISTS(SELECT 1 FROM public.platform_catalog c JOIN public.platform_products p ON p.id=c.product_id WHERE p.slug='fieldbridge' AND c.kind='plan' AND lower(c.name) IN('plus','pro','enterprise') AND NOT ('client_management'=ANY(c.modules))) THEN RAISE EXCEPTION 'Plus or higher missing staff Client management'; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_catalog c JOIN public.platform_products p ON p.id=c.product_id WHERE p.slug='fieldbridge' AND c.kind='plan' AND lower(c.name)='basic' AND 'client_management'=ANY(c.modules)) THEN RAISE EXCEPTION 'Basic unexpectedly includes staff Client management'; END IF;
  RAISE SQLSTATE 'ZX001' USING MESSAGE='All portal and tier regression checks passed; rollback fixture';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN RAISE NOTICE 'All portal and tier regression checks passed; fixture rolled back';
 END;
END $$;