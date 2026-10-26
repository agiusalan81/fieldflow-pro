ALTER TABLE public.client_contacts ADD COLUMN IF NOT EXISTS can_approve_quotes boolean NOT NULL DEFAULT false;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS quote_acceptance_mode text NOT NULL DEFAULT 'manual' CHECK (quote_acceptance_mode IN ('manual','auto_job'));
ALTER TABLE public.customer_quotes ADD COLUMN IF NOT EXISTS office_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.client_workspace(_client uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE scope jsonb:=public.client_workspace_scope(_client); c public.clients; contacts jsonb; sites jsonb; sheets jsonb; quotes jsonb; assets jsonb; me public.client_contacts; approver boolean;
BEGIN
 SELECT * INTO c FROM public.clients WHERE id=_client;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'address',s.address,'store_code',s.store_code) ORDER BY s.name),'[]'::jsonb) INTO sites FROM public.sites s WHERE s.client_id=c.id AND s.company_id=c.company_id AND ((scope->>'all_sites')::boolean OR to_jsonb(s.id::text)<@coalesce(scope->'site_ids','[]'::jsonb));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'first_name',x.first_name,'last_name',x.last_name,'email',x.email,'phone',x.phone,'role_title',x.role_title,'has_whatsapp',x.has_whatsapp,'receives_job_sheets',x.receives_job_sheets,'site_id',x.site_id,'site_ids',x.site_ids,'all_sites',x.all_sites,'delivery_preferences',x.delivery_preferences,'can_approve_quotes',x.can_approve_quotes) ORDER BY x.first_name),'[]'::jsonb) INTO contacts FROM public.client_contacts x WHERE x.client_id=c.id AND x.company_id=c.company_id AND ((scope->>'office')::boolean OR (x.id::text=scope->>'contact') OR ((scope->>'admin')::boolean AND ((scope->>'all_sites')::boolean OR (NOT x.all_sites AND to_jsonb(x.site_ids)<@scope->'site_ids'))));
 SELECT coalesce(jsonb_agg(q),'[]'::jsonb) INTO sheets FROM (SELECT s.id,s.jobsheet_number,s.created_at,s.site_id,s.reported_fault,s.repairs_performed,s.maintenance_notes FROM public.job_sheets s WHERE s.client_id=c.id AND s.company_id=c.company_id AND s.status='completed' AND ((scope->>'office')::boolean OR (scope->>'all_sites')::boolean OR (s.site_id IS NOT NULL AND to_jsonb(s.site_id::text)<@scope->'site_ids')) ORDER BY s.created_at DESC LIMIT 100) q;
 SELECT coalesce(jsonb_agg(q),'[]'::jsonb) INTO quotes FROM (SELECT cq.id,cq.reference,cq.revision,cq.status,cq.site_id,cq.issued_at,cq.decided_at,cq.signer_name,cq.snapshot FROM public.customer_quotes cq WHERE cq.client_id=c.id AND cq.company_id=c.company_id AND cq.status<>'draft' AND cq.snapshot IS NOT NULL AND ((scope->>'office')::boolean OR (scope->>'all_sites')::boolean OR (cq.site_id IS NOT NULL AND to_jsonb(cq.site_id::text)<@scope->'site_ids')) ORDER BY cq.issued_at DESC NULLS LAST LIMIT 100) q;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'reference',a.reference_number,'category',a.asset_category,'location',a.location_details,'site_id',a.site_id) ORDER BY a.reference_number),'[]'::jsonb) INTO assets FROM public.assets a WHERE a.client_id=c.id AND a.company_id=c.company_id AND ((scope->>'office')::boolean OR (scope->>'all_sites')::boolean OR (a.site_id IS NOT NULL AND to_jsonb(a.site_id::text)<@scope->'site_ids'));
 IF (scope->>'office')::boolean THEN approver:=false; ELSE SELECT * INTO me FROM public.client_contacts WHERE id=(scope->>'contact')::uuid; approver:=(scope->>'admin')::boolean OR coalesce(me.can_approve_quotes,false); END IF;
 RETURN jsonb_build_object('id',c.id,'name',c.name,'company_id',c.company_id,'scope',scope||jsonb_build_object('can_approve',approver),'sites',sites,'contacts',contacts,'sheets',sheets,'quotes',quotes,'assets',assets,'module_on',public.company_module_access(c.company_id,'client_portal'));
END $function$;

CREATE OR REPLACE FUNCTION public.save_client_contact(_client uuid, _contact uuid, _details jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE scope jsonb:=public.client_workspace_scope(_client); c public.client_contacts; cid uuid; allsites boolean:=coalesce((_details->>'all_sites')::boolean,false); ids uuid[]; pref jsonb:=_details->'delivery_preferences'; k text; v jsonb; approve boolean;
BEGIN
 IF _details IS NULL OR jsonb_typeof(_details)<>'object' OR jsonb_typeof(_details->'all_sites') IS DISTINCT FROM 'boolean' OR jsonb_typeof(_details->'has_whatsapp') IS DISTINCT FROM 'boolean' OR jsonb_typeof(_details->'site_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid contact details or site selection'; END IF;
 IF NOT (scope->>'office')::boolean AND NOT public.company_module_access((scope->>'company')::uuid,'client_portal') THEN RAISE EXCEPTION 'Client Experience module required'; END IF;
 SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO ids FROM jsonb_array_elements_text(coalesce(_details->'site_ids','[]'::jsonb));
 IF cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids)x) OR EXISTS(SELECT 1 FROM unnest(ids)x WHERE NOT EXISTS(SELECT 1 FROM public.sites WHERE id=x AND client_id=_client AND company_id=(scope->>'company')::uuid)) THEN RAISE EXCEPTION 'Choose sites belonging to this client'; END IF;
 IF NOT (scope->>'office')::boolean AND NOT (scope->>'all_sites')::boolean AND (allsites OR NOT to_jsonb(ids)<@scope->'site_ids') THEN RAISE EXCEPTION 'Cannot expand site access'; END IF;
 IF NOT allsites AND cardinality(ids)=0 THEN RAISE EXCEPTION 'Choose at least one site or all sites'; END IF;
 IF _contact IS NOT NULL THEN SELECT * INTO c FROM public.client_contacts WHERE id=_contact AND client_id=_client AND company_id=(scope->>'company')::uuid FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Contact unavailable'; END IF; END IF;
 IF NOT (scope->>'admin')::boolean THEN
  IF _contact IS NULL OR _contact::text IS DISTINCT FROM scope->>'contact' OR allsites IS DISTINCT FROM c.all_sites OR NOT (ids @> c.site_ids AND ids <@ c.site_ids) THEN RAISE EXCEPTION 'You can edit only your own contact details without changing site access'; END IF;
  approve:=c.can_approve_quotes;
 ELSE
  IF NOT (scope->>'office')::boolean AND NOT (scope->>'all_sites')::boolean AND _contact IS NOT NULL AND (c.all_sites OR NOT to_jsonb(c.site_ids)<@scope->'site_ids') THEN RAISE EXCEPTION 'Contact outside your site authority'; END IF;
  approve:=CASE WHEN jsonb_typeof(_details->'can_approve_quotes')='boolean' THEN (_details->>'can_approve_quotes')::boolean ELSE coalesce(c.can_approve_quotes,false) END;
 END IF;
 IF length(trim(coalesce(_details->>'first_name','')))=0 OR length(_details->>'first_name')>100 OR length(coalesce(_details->>'last_name',''))>100 OR length(coalesce(_details->>'phone',''))>40 OR length(coalesce(_details->>'role_title',''))>100 OR coalesce(_details->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(_details->>'email')>254 THEN RAISE EXCEPTION 'Enter valid contact details'; END IF;
 IF pref IS NOT NULL AND pref<>'null'::jsonb THEN
  IF jsonb_typeof(pref)<>'object' THEN RAISE EXCEPTION 'Invalid delivery preferences'; END IF;
  FOR k,v IN SELECT * FROM jsonb_each(pref) LOOP
   IF k NOT IN('job_sheet','eta','estimate','proposal','contract','invoice','no_access','unsigned_left') OR jsonb_typeof(v)<>'object' OR jsonb_typeof(v->'email')<>'boolean' OR jsonb_typeof(v->'whatsapp')<>'boolean' THEN RAISE EXCEPTION 'Invalid document or channel preference'; END IF;
   IF coalesce((v->>'whatsapp')::boolean,false) AND NOT coalesce((_details->>'has_whatsapp')::boolean,false) THEN RAISE EXCEPTION 'WhatsApp requires contact consent'; END IF;
  END LOOP;
 END IF;
 IF _contact IS NULL THEN
  INSERT INTO public.client_contacts(company_id,client_id,first_name,last_name,email,phone,role_title,all_sites,site_ids,site_id,delivery_preferences,has_whatsapp,receives_job_sheets,can_approve_quotes) VALUES((scope->>'company')::uuid,_client,trim(_details->>'first_name'),trim(_details->>'last_name'),lower(trim(_details->>'email')),trim(_details->>'phone'),trim(_details->>'role_title'),allsites,CASE WHEN allsites THEN '{}'::uuid[] ELSE ids END,CASE WHEN allsites THEN NULL ELSE ids[1] END,pref,coalesce((_details->>'has_whatsapp')::boolean,false),coalesce((pref->'job_sheet'->>'email')::boolean,false),approve) RETURNING id INTO cid;
 ELSE
  UPDATE public.client_contacts SET first_name=trim(_details->>'first_name'),last_name=trim(_details->>'last_name'),email=lower(trim(_details->>'email')),phone=trim(_details->>'phone'),role_title=trim(_details->>'role_title'),all_sites=allsites,site_ids=CASE WHEN allsites THEN '{}'::uuid[] ELSE ids END,site_id=CASE WHEN allsites THEN NULL ELSE ids[1] END,delivery_preferences=pref,has_whatsapp=coalesce((_details->>'has_whatsapp')::boolean,false),receives_job_sheets=coalesce((pref->'job_sheet'->>'email')::boolean,false),can_approve_quotes=approve WHERE id=_contact RETURNING id INTO cid;
 END IF;
 INSERT INTO public.client_portal_audit(company_id,client_id,actor_id,action,contact_id) VALUES((scope->>'company')::uuid,_client,auth.uid(),'contact_saved',cid);
 RETURN cid;
END $function$;

CREATE OR REPLACE FUNCTION public.delete_client_contact(_client uuid, _contact uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE scope jsonb:=public.client_workspace_scope(_client); c public.client_contacts;
BEGIN
 IF NOT (scope->>'admin')::boolean THEN RAISE EXCEPTION 'Only client administrators can remove contacts'; END IF;
 IF NOT (scope->>'office')::boolean AND NOT public.company_module_access((scope->>'company')::uuid,'client_portal') THEN RAISE EXCEPTION 'Client Experience module required'; END IF;
 IF _contact::text=scope->>'contact' THEN RAISE EXCEPTION 'You cannot remove your own contact'; END IF;
 SELECT * INTO c FROM public.client_contacts WHERE id=_contact AND client_id=_client AND company_id=(scope->>'company')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contact unavailable'; END IF;
 IF NOT (scope->>'office')::boolean AND NOT (scope->>'all_sites')::boolean AND (c.all_sites OR NOT to_jsonb(c.site_ids)<@scope->'site_ids') THEN RAISE EXCEPTION 'Contact outside your site authority'; END IF;
 IF NOT (scope->>'office')::boolean AND EXISTS(SELECT 1 FROM public.client_portal_memberships WHERE contact_id=_contact AND access_role='client_admin' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'Client administrators can only be removed by your contractor'; END IF;
 DELETE FROM public.client_portal_invites WHERE contact_id=_contact;
 DELETE FROM public.client_portal_memberships WHERE contact_id=_contact;
 DELETE FROM public.client_contacts WHERE id=_contact;
 INSERT INTO public.client_portal_audit(company_id,client_id,actor_id,action,contact_id) VALUES((scope->>'company')::uuid,_client,auth.uid(),'contact_deleted',_contact);
END $function$;
REVOKE ALL ON FUNCTION public.delete_client_contact(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.delete_client_contact(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_decide_quote(_client uuid, _quote uuid, _decision text, _name text, _comment text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE scope jsonb:=public.client_workspace_scope(_client); q public.customer_quotes; me public.client_contacts; mode text; j uuid;
BEGIN
 IF (scope->>'office')::boolean THEN RAISE EXCEPTION 'Use the office quote screen to record decisions'; END IF;
 IF NOT public.company_module_access((scope->>'company')::uuid,'client_portal') THEN RAISE EXCEPTION 'Client Experience module required'; END IF;
 SELECT * INTO me FROM public.client_contacts WHERE id=(scope->>'contact')::uuid;
 IF NOT ((scope->>'admin')::boolean OR coalesce(me.can_approve_quotes,false)) THEN RAISE EXCEPTION 'You do not have permission to approve quotes'; END IF;
 IF coalesce(_decision,'') NOT IN ('accepted','declined') OR length(trim(coalesce(_name,'')))<2 OR length(_name)>120 OR length(coalesce(_comment,''))>1000 THEN RAISE EXCEPTION 'Enter your name and decision'; END IF;
 SELECT * INTO q FROM public.customer_quotes WHERE id=_quote AND client_id=_client AND company_id=(scope->>'company')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT ((scope->>'all_sites')::boolean OR (q.site_id IS NOT NULL AND to_jsonb(q.site_id::text)<@scope->'site_ids')) THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF q.status<>'sent' THEN RAISE EXCEPTION 'This quote has already been decided'; END IF;
 IF _decision='accepted' AND (q.data->>'valid_until')::date<CURRENT_DATE THEN RAISE EXCEPTION 'This quote has expired. Ask your contractor for a new revision.'; END IF;
 UPDATE public.customer_quotes SET status=_decision,signer_name=trim(_name),decision_evidence=left('Client portal: '||coalesce(_comment,''),2000),decided_at=now(),office_seen_at=NULL,updated_at=now() WHERE id=q.id;
 INSERT INTO public.customer_quote_events(quote_id,company_id,action,actor_id,details) VALUES(q.id,q.company_id,'portal_'||_decision,auth.uid(),jsonb_build_object('name',trim(_name),'comment',_comment,'contact',me.id));
 IF _decision='accepted' AND q.job_id IS NULL THEN
  SELECT quote_acceptance_mode INTO mode FROM public.company_settings WHERE company_id=q.company_id;
  IF coalesce(mode,'manual')='auto_job' THEN
   INSERT INTO public.jobs(company_id,client_id,site_id,asset_id,scheduled_date,problem_summary,customer_quote_id) VALUES(q.company_id,q.client_id,q.site_id,q.asset_id,CURRENT_DATE,left(q.reference||': '||(q.data->>'title')||E'\n'||coalesce(q.data->>'scope',''),2000),q.id) RETURNING id INTO j;
   UPDATE public.customer_quotes SET job_id=j WHERE id=q.id;
  END IF;
 END IF;
 RETURN jsonb_build_object('id',q.id,'job_id',j);
END $function$;
REVOKE ALL ON FUNCTION public.portal_decide_quote(uuid,uuid,text,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.portal_decide_quote(uuid,uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_report_issue(_client uuid, _asset uuid, _problem text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE scope jsonb:=public.client_workspace_scope(_client); a public.assets; me public.client_contacts; rid uuid;
BEGIN
 IF (scope->>'office')::boolean THEN RAISE EXCEPTION 'Office staff should create jobs directly'; END IF;
 IF NOT public.company_module_access((scope->>'company')::uuid,'client_portal') THEN RAISE EXCEPTION 'Client Experience module required'; END IF;
 IF length(trim(coalesce(_problem,'')))<3 OR length(_problem)>2000 THEN RAISE EXCEPTION 'Describe the problem (3–2000 characters)'; END IF;
 SELECT * INTO a FROM public.assets WHERE id=_asset AND client_id=_client AND company_id=(scope->>'company')::uuid;
 IF NOT FOUND OR NOT ((scope->>'all_sites')::boolean OR (a.site_id IS NOT NULL AND to_jsonb(a.site_id::text)<@scope->'site_ids')) THEN RAISE EXCEPTION 'Equipment unavailable'; END IF;
 SELECT * INTO me FROM public.client_contacts WHERE id=(scope->>'contact')::uuid;
 IF EXISTS(SELECT 1 FROM public.equipment_problem_reports WHERE asset_id=a.id AND created_at>now()-interval '2 minutes') THEN RAISE EXCEPTION 'A report for this equipment was just sent. Please wait a moment.'; END IF;
 INSERT INTO public.equipment_problem_reports(company_id,asset_id,first_name,last_name,position,problem) VALUES(a.company_id,a.id,left(coalesce(me.first_name,'Client'),100),left(coalesce(nullif(me.last_name,''),'(portal)'),100),left(coalesce(nullif(me.role_title,''),'Client portal contact'),100),trim(_problem)) RETURNING id INTO rid;
 INSERT INTO public.client_portal_audit(company_id,client_id,actor_id,action,contact_id) VALUES(a.company_id,_client,auth.uid(),'issue_reported',me.id);
 RETURN rid;
END $function$;
REVOKE ALL ON FUNCTION public.portal_report_issue(uuid,uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.portal_report_issue(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_customer_quote_seen(_quote uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
 IF NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() THEN RAISE EXCEPTION 'Office access required'; END IF;
 UPDATE public.customer_quotes SET office_seen_at=now() WHERE id=_quote AND company_id=public.current_company_id() AND office_seen_at IS NULL;
END $function$;
REVOKE ALL ON FUNCTION public.mark_customer_quote_seen(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.mark_customer_quote_seen(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.public_quote_seen_reset() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$ BEGIN IF NEW.status IN ('accepted','declined') AND OLD.status='sent' AND NEW.office_seen_at IS NOT DISTINCT FROM OLD.office_seen_at THEN NEW.office_seen_at:=NULL; END IF; RETURN NEW; END $function$;
DROP TRIGGER IF EXISTS customer_quote_seen_reset ON public.customer_quotes;
CREATE TRIGGER customer_quote_seen_reset BEFORE UPDATE ON public.customer_quotes FOR EACH ROW EXECUTE FUNCTION public.public_quote_seen_reset();
UPDATE public.customer_quotes SET office_seen_at=coalesce(decided_at,now()) WHERE office_seen_at IS NULL;