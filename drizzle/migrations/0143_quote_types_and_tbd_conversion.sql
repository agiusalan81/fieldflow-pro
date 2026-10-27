ALTER TABLE public.company_number_counters DROP CONSTRAINT company_number_counters_kind_check;
ALTER TABLE public.company_number_counters ADD CONSTRAINT company_number_counters_kind_check CHECK(kind IN ('estimate','quote','proposal','job_sheet','invoice'));
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.save_document_numbering(jsonb)'::regprocedure) INTO d;
 d:=replace(d,'''estimate'',''proposal'',''job_sheet'',''invoice''','''estimate'',''quote'',''proposal'',''job_sheet'',''invoice'''); EXECUTE d;
 SELECT pg_get_functiondef('public.customer_quote_action(uuid,text,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'NOT public.is_company_manager()','NOT public.member_commercial_can(''estimates'')');
 d:=replace(d,'''estimate'',''proposal''','''estimate'',''quote'',''proposal''');
 d:=replace(d,'day=(_data->>''scheduled_date'')::date','day=nullif(_data->>''scheduled_date'','''')::date');
 d:=replace(d,'IF day IS NULL OR (assistant_id','IF (assistant_id');
 d:=replace(d,'WHERE NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE user_id=u AND company_id=c AND role IN (''supervisor'',''technician'',''maintenance'') AND public.member_is_active(user_id))','WHERE NOT public.is_dispatchable_member(u,c)');
 EXECUTE d;
 END $$;
CREATE OR REPLACE FUNCTION public.assign_quote_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text; parent text; k text;
BEGIN
 IF NEW.parent_id IS NOT NULL THEN
 SELECT reference INTO parent FROM public.customer_quotes WHERE id=NEW.parent_id;
 IF parent IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.customer_quotes WHERE company_id=NEW.company_id AND reference=regexp_replace(parent,'-R[0-9]+$','')||'-R'||NEW.revision) THEN NEW.reference:=regexp_replace(parent,'-R[0-9]+$','')||'-R'||NEW.revision; RETURN NEW; END IF;
 END IF;
 k:=CASE WHEN NEW.data->>'kind' IN ('quote','proposal') THEN NEW.data->>'kind' ELSE 'estimate' END;
 r:=public.next_document_number(NEW.company_id,k);
 IF r IS NULL THEN
 INSERT INTO public.company_number_counters(company_id,kind,next_value) VALUES(NEW.company_id,k,2) ON CONFLICT(company_id,kind) DO UPDATE SET next_value=company_number_counters.next_value+1 RETURNING next_value-1 INTO NEW.revision;
 r:=CASE k WHEN 'quote' THEN 'QUO-' WHEN 'proposal' THEN 'PRP-' ELSE 'EST-' END||lpad(NEW.revision::text,greatest(4,length(NEW.revision::text)),'0');
 NEW.revision:=1;
 END IF;
 NEW.reference:=r; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.quote_draft_kind_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE k text; n bigint; r text; BEGIN
 IF OLD.status='draft' AND NEW.data->>'kind' IS DISTINCT FROM OLD.data->>'kind' THEN
 k:=NEW.data->>'kind';
 IF k NOT IN ('estimate','quote','proposal') THEN RAISE EXCEPTION 'Invalid document type'; END IF;
 r:=public.next_document_number(NEW.company_id,k);
 IF r IS NULL THEN INSERT INTO public.company_number_counters(company_id,kind,next_value) VALUES(NEW.company_id,k,2) ON CONFLICT(company_id,kind) DO UPDATE SET next_value=company_number_counters.next_value+1 RETURNING next_value-1 INTO n;
 r:=CASE k WHEN 'quote' THEN 'QUO-' WHEN 'proposal' THEN 'PRP-' ELSE 'EST-' END||lpad(n::text,greatest(4,length(n::text)),'0'); END IF;
 NEW.reference:=r; END IF; RETURN NEW; END $$;
CREATE TRIGGER quote_draft_kind_number BEFORE UPDATE ON public.customer_quotes FOR EACH ROW EXECUTE FUNCTION public.quote_draft_kind_number();