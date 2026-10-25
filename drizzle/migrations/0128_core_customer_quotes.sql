CREATE TABLE public.customer_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id),reference text NOT NULL DEFAULT ('Q-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),revision integer NOT NULL DEFAULT 1,parent_id uuid REFERENCES public.customer_quotes(id),client_id uuid REFERENCES public.clients(id),site_id uuid REFERENCES public.sites(id),asset_id uuid REFERENCES public.assets(id),source_sheet_id uuid REFERENCES public.job_sheets(id),data jsonb NOT NULL DEFAULT '{}',private_notes text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','declined')),snapshot jsonb,job_id uuid REFERENCES public.jobs(id),created_by uuid NOT NULL DEFAULT auth.uid(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),issued_at timestamptz,decided_at timestamptz,signer_name text,decision_evidence text,UNIQUE(company_id,reference));
GRANT SELECT ON public.customer_quotes TO authenticated; GRANT ALL ON public.customer_quotes TO service_role;
ALTER TABLE public.customer_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Office reads customer quotes" ON public.customer_quotes FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()));
CREATE INDEX customer_quotes_updated ON public.customer_quotes(company_id,updated_at DESC);
CREATE TABLE public.customer_quote_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quote_id uuid NOT NULL REFERENCES public.customer_quotes(id) ON DELETE CASCADE,company_id uuid NOT NULL REFERENCES public.companies(id),action text NOT NULL,actor_id uuid DEFAULT auth.uid(),details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.customer_quote_events TO authenticated; GRANT ALL ON public.customer_quote_events TO service_role;
ALTER TABLE public.customer_quote_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Office reads quote history" ON public.customer_quote_events FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()));
CREATE TABLE public.customer_quote_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quote_id uuid NOT NULL REFERENCES public.customer_quotes(id) ON DELETE CASCADE,token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,revoked_at timestamptz,allow_decision boolean NOT NULL DEFAULT false);
GRANT ALL ON public.customer_quote_links TO service_role; ALTER TABLE public.customer_quote_links ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.customer_quote_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quote_id uuid NOT NULL REFERENCES public.customer_quotes(id) ON DELETE CASCADE,company_id uuid NOT NULL REFERENCES public.companies(id),contact_id text NOT NULL,outcome text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(quote_id,contact_id));
GRANT SELECT ON public.customer_quote_deliveries TO authenticated; GRANT ALL ON public.customer_quote_deliveries TO service_role;
ALTER TABLE public.customer_quote_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Office reads delivery" ON public.customer_quote_deliveries FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()));
ALTER TABLE public.jobs ADD COLUMN customer_quote_id uuid REFERENCES public.customer_quotes(id);
ALTER TABLE public.job_sheets ADD COLUMN customer_quote_id uuid REFERENCES public.customer_quotes(id);
CREATE UNIQUE INDEX jobs_one_customer_quote ON public.jobs(customer_quote_id) WHERE customer_quote_id IS NOT NULL;
CREATE FUNCTION public.customer_quote_totals(_lines jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE l jsonb;s numeric;d numeric;n numeric;sub numeric=0;disc numeric=0;net numeric=0;tax numeric=0;
BEGIN
 IF jsonb_typeof(_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(_lines)>100 THEN RAISE EXCEPTION 'Use up to 100 items'; END IF;
 FOR l IN SELECT value FROM jsonb_array_elements(_lines) LOOP
 IF length(trim(coalesce(l->>'description','')))=0 OR length(l->>'description')>1000 OR (l->>'quantity') IS NULL OR (l->>'rate') IS NULL OR (l->>'discount') IS NULL OR (l->>'vat') IS NULL OR (l->>'quantity')::numeric<=0 OR (l->>'quantity')::numeric>1000000 OR (l->>'rate')::numeric<0 OR (l->>'rate')::numeric>100000000 OR (l->>'discount')::numeric NOT BETWEEN 0 AND 100 OR (l->>'vat')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Check quote item values'; END IF;
 s=round((l->>'quantity')::numeric*(l->>'rate')::numeric,2);d=round(s*(l->>'discount')::numeric/100,2);n=s-d;sub=sub+s;disc=disc+d;net=net+n;tax=tax+round(n*(l->>'vat')::numeric/100,2);
 END LOOP;
 RETURN jsonb_build_object('subtotal',sub,'discount',disc,'net',net,'vat',tax,'total',net+tax);
END $$;
CREATE FUNCTION public.customer_quote_action(_id uuid,_action text,_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 UPDATE public.customer_quotes SET status=_data->>'decision',signer_name=trim(_data->>'name'),decision_evidence=trim(_data->>'evidence'),decided_at=now(),updated_at=now() WHERE id=q.id;
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
END $$;
REVOKE ALL ON FUNCTION public.customer_quote_action(uuid,text,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.customer_quote_action(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.read_customer_quote(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.customer_quotes;approval boolean;
BEGIN
 IF _token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT cq.* INTO q FROM public.customer_quotes cq JOIN public.customer_quote_links cl ON cl.quote_id=cq.id WHERE cl.token_hash=encode(extensions.digest(_token,'sha256'),'hex') AND cl.revoked_at IS NULL AND cl.expires_at>now();IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT allow_decision INTO approval FROM public.customer_quote_links WHERE token_hash=encode(extensions.digest(_token,'sha256'),'hex');
 RETURN q.snapshot||jsonb_build_object('status',q.status,'signer_name',q.signer_name,'decided_at',q.decided_at,'allow_decision',approval);
END $$;
REVOKE ALL ON FUNCTION public.read_customer_quote(text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.read_customer_quote(text) TO anon,authenticated;
CREATE FUNCTION public.decide_customer_quote(_token text,_decision text,_name text,_comment text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.customer_quotes;
BEGIN
 IF _token !~ '^[a-f0-9]{64}$' OR coalesce(_decision,'') NOT IN ('accepted','declined') OR length(trim(coalesce(_name,'')))<2 OR length(_name)>120 OR length(_comment)>1000 THEN RAISE EXCEPTION 'Check your name and decision'; END IF;
 SELECT cq.* INTO q FROM public.customer_quotes cq JOIN public.customer_quote_links cl ON cl.quote_id=cq.id WHERE cl.token_hash=encode(extensions.digest(_token,'sha256'),'hex') AND cl.revoked_at IS NULL AND cl.expires_at>now() AND cl.allow_decision FOR UPDATE OF cq;
 IF NOT FOUND OR q.status<>'sent' OR (q.data->>'valid_until')::date<CURRENT_DATE OR NOT public.company_module_access(q.company_id,'client_portal') THEN RAISE EXCEPTION 'Quote cannot be approved using this link'; END IF;
 UPDATE public.customer_quotes SET status=_decision,signer_name=trim(_name),decision_evidence=_comment,decided_at=now(),updated_at=now() WHERE id=q.id;
 INSERT INTO public.customer_quote_events(quote_id,company_id,action,actor_id,details) VALUES(q.id,q.company_id,'customer_'||_decision,NULL,jsonb_build_object('name',trim(_name),'comment',_comment));
END $$;
REVOKE ALL ON FUNCTION public.decide_customer_quote(text,text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.decide_customer_quote(text,text,text,text) TO anon,authenticated;
CREATE FUNCTION public.capture_customer_quote_on_sheet() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN NEW.customer_quote_id=(SELECT customer_quote_id FROM public.jobs WHERE id=NEW.job_id AND company_id=NEW.company_id);RETURN NEW;END $$;
CREATE TRIGGER job_sheets_capture_customer_quote BEFORE INSERT OR UPDATE OF job_id,customer_quote_id ON public.job_sheets FOR EACH ROW EXECUTE FUNCTION public.capture_customer_quote_on_sheet();