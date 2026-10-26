ALTER TABLE public.customer_quotes DROP CONSTRAINT customer_quotes_status_check;
ALTER TABLE public.customer_quotes ADD CONSTRAINT customer_quotes_status_check CHECK(status IN ('draft','sent','awaiting_confirmation','accepted','declined'));
ALTER TABLE public.customer_quotes ADD COLUMN IF NOT EXISTS office_recorded jsonb;
CREATE OR REPLACE FUNCTION public.customer_quote_action(_id uuid, _action text, _data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c uuid=public.current_company_id();q public.customer_quotes;p jsonb;settings public.company_settings;rid uuid;tok text;j uuid;lead_id uuid;assistant_id uuid;day date;s public.job_sheets;
BEGIN
 IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() OR NOT public.company_module_access(c,'core') THEN RAISE EXCEPTION 'Active office or supervisor Core access required'; END IF;
 SELECT * INTO q FROM public.customer_quotes WHERE id=_id AND company_id=c FOR UPDATE;
 IF _action='save' THEN
 IF FOUND AND q.status<>'draft' THEN RAISE EXCEPTION 'Issued quotes cannot be edited. Create a revision.'; END IF;
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.customer_quotes WHERE id=_id) THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 p=_data->'data';
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR coalesce(p->>'kind','') NOT IN ('estimate','proposal') OR length(trim(coalesce(p->>'title','')))=0 OR length(p->>'title')>200 OR (p->>'issue_date')::date IS NULL OR (p->>'valid_until')::date IS NULL OR (p->>'valid_until')::date<(p->>'issue_date')::date OR length(p::text)>150000 OR length(coalesce(_data->>'private_notes',''))>10000 THEN RAISE EXCEPTION 'Check title, dates and contents'; END IF;
 PERFORM public.customer_quote_totals(p->'lines');
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=(_data->>'client_id')::uuid AND company_id=c) THEN RAISE EXCEPTION 'Choose a company client'; END IF;
 IF nullif(_data->>'site_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sites WHERE id=(_data->>'site_id')::uuid AND client_id=(_data->>'client_id')::uuid AND company_id=c) THEN RAISE EXCEPTION 'Choose a client site'; END IF;
 IF nullif(_data->>'asset_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.assets WHERE id=(_data->>'asset_id')::uuid AND client_id=(_data->>'client_id')::uuid AND company_id=c AND (site_id IS NULL OR site_id=nullif(_data->>'site_id','')::uuid)) THEN RAISE EXCEPTION 'Choose matching client equipment'; END IF;
 IF nullif(_data->>'source_sheet_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.job_sheets WHERE id=(_data->>'source_sheet_id')::uuid AND company_id=c AND client_id=(_data->>'client_id')::uuid) THEN RAISE EXCEPTION 'Source sheet unavailable'; END IF;
 INSERT INTO public.customer_quotes(id,company_id,client_id,site_id,asset_id,source_sheet_id,data,private_notes) VALUES(_id,c,(_data->>'client_id')::uuid,nullif(_data->>'site_id','')::uuid,nullif(_data->>'asset_id','')::uuid,nullif(_data->>'source_sheet_id','')::uuid,p,coalesce(_data->>'private_notes','')) ON CONFLICT(id) DO UPDATE SET client_id=EXCLUDED.client_id,site_id=EXCLUDED.site_id,asset_id=EXCLUDED.asset_id,source_sheet_id=EXCLUDED.source_sheet_id,data=EXCLUDED.data,private_notes=EXCLUDED.private_notes,updated_at=now() RETURNING * INTO q;
 ELSE
 IF q.id IS NULL THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF _action='delete' THEN
 IF q.status<>'draft' THEN RAISE EXCEPTION 'Only drafts can be deleted'; END IF;
 DELETE FROM public.customer_quotes WHERE id=q.id;RETURN jsonb_build_object('id',q.id);
 ELSIF _action='issue' THEN
 IF q.status<>'draft' THEN RETURN jsonb_build_object('id',q.id); END IF;
 IF jsonb_array_length(q.data->'lines')=0 OR (q.data->>'valid_until')::date<CURRENT_DATE THEN RAISE EXCEPTION 'Add items and current validity date'; END IF;
 SELECT * INTO settings FROM public.company_settings WHERE company_id=c;
 UPDATE public.customer_quotes SET status='sent',issued_at=now(),updated_at=now(),snapshot=jsonb_build_object('reference',q.reference,'revision',q.revision,'document',q.data,'totals',public.customer_quote_totals(q.data->'lines'),'client',(SELECT name FROM public.clients WHERE id=q.client_id),'site',(SELECT concat(CASE WHEN coalesce(store_code,'')<>'' THEN '[#'||store_code||'] ' ELSE '' END,name,CASE WHEN coalesce(address,'')<>'' THEN ' — '||address ELSE '' END) FROM public.sites WHERE id=q.site_id),'equipment',(SELECT reference_number FROM public.assets WHERE id=q.asset_id),'company',jsonb_build_object('name',(SELECT name FROM public.companies WHERE id=c),'logo',settings.logo_data,'address',settings.company_address,'vat',settings.vat_number,'primary',settings.pdf_template->>'primaryColor','footer',settings.pdf_template->>'footer'),'currency',coalesce(settings.currency,'EUR')) WHERE id=q.id;
 ELSIF _action='decide' THEN
 IF q.status<>'sent' OR coalesce(_data->>'decision','') NOT IN ('accepted','declined') OR length(trim(coalesce(_data->>'name','')))<2 OR length(_data->>'name')>120 OR length(trim(coalesce(_data->>'evidence','')))<2 OR length(_data->>'evidence')>2000 THEN RAISE EXCEPTION 'Record customer name and decision evidence'; END IF;
 IF _data->>'decision'='accepted' AND (q.data->>'valid_until')::date<CURRENT_DATE THEN RAISE EXCEPTION 'Quote expired. Create a current revision.'; END IF;
 UPDATE public.customer_quotes SET status=CASE WHEN _data->>'decision'='accepted' THEN 'awaiting_confirmation' ELSE 'declined' END,signer_name=trim(_data->>'name'),decision_evidence=trim(_data->>'evidence'),office_recorded=jsonb_build_object('name',trim(_data->>'name'),'evidence',trim(_data->>'evidence'),'at',now(),'decision',_data->>'decision'),decided_at=now(),office_seen_at=now(),updated_at=now() WHERE id=q.id;
 ELSIF _action='revise' THEN
 IF q.status='draft' THEN RAISE EXCEPTION 'Edit the existing draft'; END IF;
 INSERT INTO public.customer_quotes(company_id,parent_id,revision,client_id,site_id,asset_id,source_sheet_id,data,private_notes) VALUES(c,q.id,q.revision+1,q.client_id,q.site_id,q.asset_id,q.source_sheet_id,q.data||jsonb_build_object('issue_date',CURRENT_DATE,'valid_until',CURRENT_DATE+30),q.private_notes) RETURNING id INTO rid;RETURN jsonb_build_object('id',rid);
 ELSIF _action='link' THEN
 IF q.status='draft' THEN RAISE EXCEPTION 'Issue before sharing'; END IF;
 IF coalesce((_data->>'approval')::boolean,false) AND NOT public.company_module_access(c,'client_portal') THEN RAISE EXCEPTION 'Online approval requires Client Experience'; END IF;
 tok=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.customer_quote_links(quote_id,token_hash,expires_at,allow_decision) VALUES(q.id,encode(extensions.digest(tok,'sha256'),'hex'),greatest(now()+interval '1 day',(q.data->>'valid_until')::date+interval '1 day'),coalesce((_data->>'approval')::boolean,false));RETURN jsonb_build_object('id',q.id,'token',tok);
 ELSIF _action='revoke' THEN UPDATE public.customer_quote_links SET revoked_at=now() WHERE quote_id=q.id AND revoked_at IS NULL;
 ELSIF _action='convert' THEN
 IF q.job_id IS NOT NULL THEN RETURN jsonb_build_object('id',q.id,'job_id',q.job_id); END IF;
 IF q.status<>'accepted' THEN RAISE EXCEPTION 'Only accepted quotes can be converted'; END IF;
 day=(_data->>'scheduled_date')::date;lead_id=nullif(_data->>'tech','none')::uuid;assistant_id=nullif(_data->>'assistant','none')::uuid;
 IF day IS NULL OR (assistant_id IS NOT NULL AND (lead_id IS NULL OR assistant_id=lead_id)) OR (nullif(_data->>'window_end','')::time<nullif(_data->>'window_start','')::time) THEN RAISE EXCEPTION 'Choose valid date, time window and staffing'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(array_remove(ARRAY[lead_id,assistant_id],NULL)) u WHERE NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE user_id=u AND company_id=c AND role IN ('supervisor','technician','maintenance') AND public.member_is_active(user_id))) THEN RAISE EXCEPTION 'Choose active company field staff'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=q.client_id AND company_id=c) THEN RAISE EXCEPTION 'Client unavailable'; END IF;
 IF q.source_sheet_id IS NOT NULL THEN SELECT * INTO s FROM public.job_sheets WHERE id=q.source_sheet_id AND company_id=c FOR UPDATE;IF s.pending_job_id IS NOT NULL THEN RAISE EXCEPTION 'Pending work already has a follow-up visit'; END IF; END IF;
 INSERT INTO public.jobs(company_id,client_id,site_id,asset_id,assigned_technician_id,secondary_technician_id,required_team_size,scheduled_date,window_start,window_end,problem_summary,customer_quote_id) VALUES(c,q.client_id,q.site_id,q.asset_id,lead_id,assistant_id,CASE WHEN assistant_id IS NULL THEN 1 ELSE 2 END,day,nullif(_data->>'window_start','')::time,nullif(_data->>'window_end','')::time,left(q.reference||': '||(q.data->>'title')||E'\n'||coalesce(q.data->>'scope',''),2000),q.id) RETURNING id INTO j;
 UPDATE public.customer_quotes SET job_id=j,updated_at=now() WHERE id=q.id;
 IF q.source_sheet_id IS NOT NULL AND coalesce(s.pending_works_future_jobs,'')<>'' AND s.pending_status<>'done' THEN UPDATE public.job_sheets SET pending_job_id=j,pending_status='scheduled' WHERE id=q.source_sheet_id; END IF;
 ELSE RAISE EXCEPTION 'Unknown quote action'; END IF;
 END IF;
 INSERT INTO public.customer_quote_events(quote_id,company_id,action,details) VALUES(q.id,c,_action,CASE WHEN _action='decide' THEN _data ELSE '{}'::jsonb END);
 RETURN jsonb_build_object('id',q.id,'job_id',j);
END $function$;
CREATE OR REPLACE FUNCTION public.portal_decide_quote(_client uuid, _quote uuid, _decision text, _name text, _comment text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE scope jsonb:=public.client_workspace_scope(_client); q public.customer_quotes; me public.client_contacts; mode text; j uuid;
BEGIN
 IF (scope->>'office')::boolean THEN RAISE EXCEPTION 'Use the office quote screen to record decisions'; END IF;
 IF NOT public.company_module_access((scope->>'company')::uuid,'client_portal') THEN RAISE EXCEPTION 'Client Experience module required'; END IF;
 SELECT * INTO me FROM public.client_contacts WHERE id=(scope->>'contact')::uuid;
 IF NOT ((scope->>'admin')::boolean OR coalesce(me.can_approve_quotes,false)) THEN RAISE EXCEPTION 'You do not have permission to approve quotes'; END IF;
 IF coalesce(_decision,'') NOT IN ('accepted','declined') OR length(trim(coalesce(_name,'')))<2 OR length(_name)>120 OR length(coalesce(_comment,''))>1000 THEN RAISE EXCEPTION 'Enter your name and decision'; END IF;
 SELECT * INTO q FROM public.customer_quotes WHERE id=_quote AND client_id=_client AND company_id=(scope->>'company')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT ((scope->>'all_sites')::boolean OR (q.site_id IS NOT NULL AND to_jsonb(q.site_id::text)<@scope->'site_ids')) THEN RAISE EXCEPTION 'Quote unavailable'; END IF;
 IF q.status NOT IN ('sent','awaiting_confirmation') THEN RAISE EXCEPTION 'This quote has already been decided'; END IF;
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
CREATE OR REPLACE FUNCTION public.decide_customer_quote(_token text, _decision text, _name text, _comment text DEFAULT ''::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE q public.customer_quotes;
BEGIN
 IF _token !~ '^[a-f0-9]{64}$' OR coalesce(_decision,'') NOT IN ('accepted','declined') OR length(trim(coalesce(_name,'')))<2 OR length(_name)>120 OR length(_comment)>1000 THEN RAISE EXCEPTION 'Check your name and decision'; END IF;
 SELECT cq.* INTO q FROM public.customer_quotes cq JOIN public.customer_quote_links cl ON cl.quote_id=cq.id WHERE cl.token_hash=encode(extensions.digest(_token,'sha256'),'hex') AND cl.revoked_at IS NULL AND cl.expires_at>now() AND cl.allow_decision FOR UPDATE OF cq;
 IF NOT FOUND OR q.status NOT IN ('sent','awaiting_confirmation') OR (_decision='accepted' AND (q.data->>'valid_until')::date<CURRENT_DATE) OR NOT public.company_module_access(q.company_id,'client_portal') THEN RAISE EXCEPTION 'Quote cannot be approved using this link'; END IF;
 UPDATE public.customer_quotes SET status=_decision,signer_name=trim(_name),decision_evidence=_comment,decided_at=now(),office_seen_at=NULL,updated_at=now() WHERE id=q.id;
 INSERT INTO public.customer_quote_events(quote_id,company_id,action,actor_id,details) VALUES(q.id,q.company_id,'customer_'||_decision,NULL,jsonb_build_object('name',trim(_name),'comment',_comment));
END $function$;
CREATE OR REPLACE FUNCTION public.client_workspace(_client uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE scope jsonb:=public.client_workspace_scope(_client); c public.clients; contacts jsonb; sites jsonb; sheets jsonb; quotes jsonb; assets jsonb; me public.client_contacts; approver boolean;
BEGIN
 SELECT * INTO c FROM public.clients WHERE id=_client;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'address',s.address,'store_code',s.store_code) ORDER BY s.name),'[]'::jsonb) INTO sites FROM public.sites s WHERE s.client_id=c.id AND s.company_id=c.company_id AND ((scope->>'all_sites')::boolean OR to_jsonb(s.id::text)<@coalesce(scope->'site_ids','[]'::jsonb));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'first_name',x.first_name,'last_name',x.last_name,'email',x.email,'phone',x.phone,'role_title',x.role_title,'has_whatsapp',x.has_whatsapp,'receives_job_sheets',x.receives_job_sheets,'site_id',x.site_id,'site_ids',x.site_ids,'all_sites',x.all_sites,'delivery_preferences',x.delivery_preferences,'can_approve_quotes',x.can_approve_quotes) ORDER BY x.first_name),'[]'::jsonb) INTO contacts FROM public.client_contacts x WHERE x.client_id=c.id AND x.company_id=c.company_id AND ((scope->>'office')::boolean OR (x.id::text=scope->>'contact') OR ((scope->>'admin')::boolean AND ((scope->>'all_sites')::boolean OR (NOT x.all_sites AND to_jsonb(x.site_ids)<@scope->'site_ids'))));
 SELECT coalesce(jsonb_agg(q),'[]'::jsonb) INTO sheets FROM (SELECT s.id,s.jobsheet_number,s.created_at,s.site_id,s.reported_fault,s.repairs_performed,s.maintenance_notes FROM public.job_sheets s WHERE s.client_id=c.id AND s.company_id=c.company_id AND s.status='completed' AND ((scope->>'office')::boolean OR (scope->>'all_sites')::boolean OR (s.site_id IS NOT NULL AND to_jsonb(s.site_id::text)<@scope->'site_ids')) ORDER BY s.created_at DESC LIMIT 100) q;
 SELECT coalesce(jsonb_agg(q),'[]'::jsonb) INTO quotes FROM (SELECT cq.id,cq.reference,cq.revision,cq.status,cq.site_id,cq.issued_at,cq.decided_at,cq.signer_name,cq.snapshot,cq.office_recorded FROM public.customer_quotes cq WHERE cq.client_id=c.id AND cq.company_id=c.company_id AND cq.status<>'draft' AND cq.snapshot IS NOT NULL AND ((scope->>'office')::boolean OR (scope->>'all_sites')::boolean OR (cq.site_id IS NOT NULL AND to_jsonb(cq.site_id::text)<@scope->'site_ids')) ORDER BY cq.issued_at DESC NULLS LAST LIMIT 100) q;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'reference',a.reference_number,'category',a.asset_category,'location',a.location_details,'site_id',a.site_id) ORDER BY a.reference_number),'[]'::jsonb) INTO assets FROM public.assets a WHERE a.client_id=c.id AND a.company_id=c.company_id AND ((scope->>'office')::boolean OR (scope->>'all_sites')::boolean OR (a.site_id IS NOT NULL AND to_jsonb(a.site_id::text)<@scope->'site_ids'));
 IF (scope->>'office')::boolean THEN approver:=false; ELSE SELECT * INTO me FROM public.client_contacts WHERE id=(scope->>'contact')::uuid; approver:=(scope->>'admin')::boolean OR coalesce(me.can_approve_quotes,false); END IF;
 RETURN jsonb_build_object('id',c.id,'name',c.name,'company_id',c.company_id,'scope',scope||jsonb_build_object('can_approve',approver),'sites',sites,'contacts',contacts,'sheets',sheets,'quotes',quotes,'assets',assets,'module_on',public.company_module_access(c.company_id,'client_portal'));
END $function$;