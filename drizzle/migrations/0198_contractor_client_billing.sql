CREATE OR REPLACE FUNCTION public.client_billing_can() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id=r.user_id AND u.company_id=r.company_id JOIN public.platform_products p ON p.id=public.company_product_id(r.company_id) WHERE r.user_id=auth.uid() AND r.registration_status='active' AND r.role IN ('superuser','admin') AND p.engine_edition='contractor') $$;
GRANT EXECUTE ON FUNCTION public.client_billing_can() TO authenticated;
CREATE TABLE public.client_billing_settings(company_id uuid PRIMARY KEY DEFAULT public.current_company_id() REFERENCES public.companies(id), proforma_enabled boolean NOT NULL DEFAULT false, payment_request_enabled boolean NOT NULL DEFAULT false, invoice_enabled boolean NOT NULL DEFAULT false, defaults jsonb NOT NULL DEFAULT '{}', formats jsonb NOT NULL DEFAULT '{"proforma":{"prefix":"PRO-","padding":5},"payment_request":{"prefix":"PAY-","padding":5},"invoice":{"prefix":"INV-","padding":5}}');
GRANT SELECT,INSERT,UPDATE ON public.client_billing_settings TO authenticated; GRANT ALL ON public.client_billing_settings TO service_role;
ALTER TABLE public.client_billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_settings_office ON public.client_billing_settings FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.client_billing_can()) WITH CHECK(company_id=public.current_company_id() AND public.client_billing_can());
CREATE TRIGGER billing_settings_entitlement BEFORE INSERT OR UPDATE ON public.client_billing_settings FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('core');
CREATE TABLE public.client_billing_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id), kind text NOT NULL DEFAULT 'payment_request' CHECK(kind IN ('proforma','payment_request','invoice')), client_id uuid REFERENCES public.clients(id), source_quote_id uuid REFERENCES public.customer_quotes(id), source_sheet_id uuid REFERENCES public.job_sheets(id), source_document_id uuid REFERENCES public.client_billing_documents(id), data jsonb NOT NULL DEFAULT '{}', reference text, snapshot jsonb, issued_at timestamptz, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,kind,reference), UNIQUE(source_document_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.client_billing_documents TO authenticated; GRANT ALL ON public.client_billing_documents TO service_role;
ALTER TABLE public.client_billing_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_documents_office ON public.client_billing_documents FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.client_billing_can()) WITH CHECK(company_id=public.current_company_id() AND public.client_billing_can());
CREATE TABLE public.client_billing_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id), document_id uuid NOT NULL REFERENCES public.client_billing_documents(id), amount numeric(14,2) NOT NULL CHECK(amount>0), paid_on date NOT NULL DEFAULT current_date, method text NOT NULL, reference text NOT NULL DEFAULT '', created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), request_id uuid NOT NULL DEFAULT gen_random_uuid(), UNIQUE(document_id,request_id));
GRANT SELECT,INSERT ON public.client_billing_payments TO authenticated; GRANT ALL ON public.client_billing_payments TO service_role;
ALTER TABLE public.client_billing_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_payments_read ON public.client_billing_payments FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.client_billing_can());
CREATE POLICY billing_payments_insert ON public.client_billing_payments FOR INSERT TO authenticated WITH CHECK(company_id=public.current_company_id() AND public.client_billing_can());
CREATE OR REPLACE FUNCTION public.guard_client_billing_document() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg public.client_billing_settings; q public.customer_quotes; s public.job_sheets; l jsonb; BEGIN
IF NOT public.client_billing_can() OR NOT public.company_module_access(public.current_company_id(),'core') THEN RAISE EXCEPTION 'Client billing is office-only and requires active Core access'; END IF;
IF TG_OP='DELETE' THEN IF OLD.issued_at IS NOT NULL THEN RAISE EXCEPTION 'Issued documents cannot be deleted'; END IF; RETURN OLD; END IF;
IF NEW.company_id IS DISTINCT FROM public.current_company_id() THEN RAISE EXCEPTION 'Invalid company'; END IF;
IF TG_OP='UPDATE' THEN
IF OLD.issued_at IS NOT NULL THEN RAISE EXCEPTION 'Issued documents are immutable'; END IF;
IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.source_quote_id IS DISTINCT FROM OLD.source_quote_id OR NEW.source_sheet_id IS DISTINCT FROM OLD.source_sheet_id OR NEW.source_document_id IS DISTINCT FROM OLD.source_document_id THEN RAISE EXCEPTION 'Document source and identity are fixed'; END IF;
END IF;
SELECT * INTO cfg FROM public.client_billing_settings WHERE company_id=NEW.company_id;
IF NOT coalesce(CASE NEW.kind WHEN 'proforma' THEN cfg.proforma_enabled WHEN 'payment_request' THEN cfg.payment_request_enabled ELSE cfg.invoice_enabled END,false) THEN RAISE EXCEPTION 'Enable this document type in Company settings first'; END IF;
IF NEW.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=NEW.client_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Client is not available'; END IF;
IF NEW.source_quote_id IS NOT NULL THEN SELECT * INTO q FROM public.customer_quotes WHERE id=NEW.source_quote_id AND company_id=NEW.company_id; IF q.id IS NULL OR q.status<>'accepted' OR q.client_id IS DISTINCT FROM NEW.client_id OR NEW.kind<>'proforma' THEN RAISE EXCEPTION 'Proformas require an agreed quote or estimate for this client'; END IF; END IF;
IF NEW.source_sheet_id IS NOT NULL THEN SELECT * INTO s FROM public.job_sheets WHERE id=NEW.source_sheet_id AND company_id=NEW.company_id; IF s.id IS NULL OR s.status::text<>'completed' OR s.client_id IS DISTINCT FROM NEW.client_id OR NEW.kind<>'payment_request' THEN RAISE EXCEPTION 'Payment requests require a completed job sheet for this client'; END IF; END IF;
IF NEW.source_document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.client_billing_documents WHERE id=NEW.source_document_id AND company_id=NEW.company_id AND issued_at IS NOT NULL AND kind<>'invoice' AND client_id=NEW.client_id) THEN RAISE EXCEPTION 'Invalid invoice conversion source'; END IF;
IF jsonb_typeof(NEW.data)<>'object' OR jsonb_typeof(NEW.data->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.data->'lines')>100 THEN RAISE EXCEPTION 'Invalid document lines'; END IF;
FOR l IN SELECT value FROM jsonb_array_elements(NEW.data->'lines') LOOP
IF coalesce((l->>'quantity')::numeric,0)<=0 OR coalesce((l->>'rate')::numeric,-1)<0 OR coalesce((l->>'vat')::numeric,-1) NOT BETWEEN 0 AND 100 OR coalesce((l->>'discount')::numeric,-1) NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid line amounts'; END IF;
END LOOP;
IF NEW.issued_at IS NOT NULL AND coalesce(current_setting('app.billing_issue',true),'') IS DISTINCT FROM NEW.id::text THEN RAISE EXCEPTION 'Use the explicit issue action'; END IF;
IF NEW.issued_at IS NULL AND (NEW.reference IS NOT NULL OR NEW.snapshot IS NOT NULL) THEN RAISE EXCEPTION 'Drafts cannot have issued snapshots'; END IF;
NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER billing_documents_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_billing_documents FOR EACH ROW EXECUTE FUNCTION public.guard_client_billing_document();
CREATE OR REPLACE FUNCTION public.issue_client_billing(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.client_billing_documents; cfg public.client_billing_settings; c public.clients; co public.companies; cs public.company_settings; f jsonb; n bigint; ref text; totals jsonb; BEGIN
IF NOT public.client_billing_can() THEN RAISE EXCEPTION 'Office access required'; END IF;
SELECT * INTO d FROM public.client_billing_documents WHERE id=_id AND company_id=public.current_company_id() FOR UPDATE; IF d.id IS NULL THEN RAISE EXCEPTION 'Document unavailable'; END IF; IF d.issued_at IS NOT NULL THEN RETURN d.id; END IF;
IF d.client_id IS NULL OR jsonb_array_length(d.data->'lines')=0 OR length(trim(coalesce(d.data->>'title','')))=0 THEN RAISE EXCEPTION 'Enter a client, title and at least one line'; END IF;
IF (d.data->>'due_date')::date<(d.data->>'issue_date')::date THEN RAISE EXCEPTION 'Due date cannot precede issue date'; END IF;
IF EXISTS(SELECT 1 FROM jsonb_array_elements(d.data->'lines') l WHERE length(trim(coalesce(l->>'description','')))=0) THEN RAISE EXCEPTION 'Enter every line description'; END IF;
SELECT * INTO cfg FROM public.client_billing_settings WHERE company_id=d.company_id;
SELECT * INTO c FROM public.clients WHERE id=d.client_id; SELECT * INTO co FROM public.companies WHERE id=d.company_id; SELECT * INTO cs FROM public.company_settings WHERE company_id=d.company_id;
IF length(trim(coalesce(cs.company_address,'')))=0 THEN RAISE EXCEPTION 'Set your company address before issuing'; END IF;
IF d.kind='invoice' AND length(trim(coalesce(cs.vat_number,'')))=0 AND NOT coalesce((d.data->>'tax_exempt')::boolean,false) THEN RAISE EXCEPTION 'Set your VAT number or explicitly confirm non-VAT registration'; END IF;
f=cfg.formats->d.kind; IF length(coalesce(f->>'prefix',''))>30 OR coalesce((f->>'padding')::int,5) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid numbering format'; END IF;
INSERT INTO public.company_number_counters(company_id,kind,next_value) VALUES(d.company_id,CASE WHEN d.kind='invoice' THEN 'invoice' ELSE 'billing_'||d.kind END,2) ON CONFLICT(company_id,kind) DO UPDATE SET next_value=public.company_number_counters.next_value+1 RETURNING next_value-1 INTO n;
ref=coalesce(f->>'prefix',CASE d.kind WHEN 'proforma' THEN 'PRO-' WHEN 'payment_request' THEN 'PAY-' ELSE 'INV-' END)||lpad(n::text,greatest(length(n::text),coalesce((f->>'padding')::int,5)),'0');
totals=public.customer_quote_totals(d.data->'lines');
PERFORM set_config('app.billing_issue',d.id::text,true);
UPDATE public.client_billing_documents SET reference=ref,issued_at=now(),snapshot=jsonb_build_object('kind',d.kind,'reference',ref,'document',d.data,'totals',totals,'currency',cs.currency,'company',jsonb_build_object('name',co.name,'address',cs.company_address,'vat',cs.vat_number,'logo',cs.logo_data),'client',jsonb_build_object('name',c.name,'address',c.address,'email',c.email),'source_document_id',d.source_document_id) WHERE id=d.id;
RETURN d.id; END $$;
GRANT EXECUTE ON FUNCTION public.issue_client_billing(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.convert_client_billing(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.client_billing_documents; result uuid; BEGIN
IF NOT public.client_billing_can() THEN RAISE EXCEPTION 'Office access required'; END IF;
SELECT * INTO d FROM public.client_billing_documents WHERE id=_id AND company_id=public.current_company_id() FOR UPDATE;
IF d.id IS NULL OR d.issued_at IS NULL OR d.kind='invoice' THEN RAISE EXCEPTION 'Only issued proformas or payment requests can convert'; END IF;
SELECT id INTO result FROM public.client_billing_documents WHERE source_document_id=d.id; IF result IS NOT NULL THEN RETURN result; END IF;
INSERT INTO public.client_billing_documents(kind,client_id,source_document_id,data) VALUES('invoice',d.client_id,d.id,d.data||jsonb_build_object('issue_date',current_date::text)) RETURNING id INTO result; RETURN result; END $$;
GRANT EXECUTE ON FUNCTION public.convert_client_billing(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_client_billing_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.client_billing_documents; paid numeric; BEGIN
IF NOT public.client_billing_can() OR NOT public.company_module_access(public.current_company_id(),'core') OR NEW.company_id IS DISTINCT FROM public.current_company_id() THEN RAISE EXCEPTION 'Office billing access required'; END IF;
SELECT * INTO d FROM public.client_billing_documents WHERE id=NEW.document_id AND company_id=NEW.company_id FOR UPDATE;
IF d.id IS NULL OR d.issued_at IS NULL THEN RAISE EXCEPTION 'Issue the document before recording payment'; END IF;
IF EXISTS(SELECT 1 FROM public.client_billing_payments WHERE document_id=d.id AND request_id=NEW.request_id) THEN RETURN NULL; END IF;
IF EXISTS(SELECT 1 FROM public.client_billing_documents WHERE source_document_id=d.id) THEN RAISE EXCEPTION 'Record payment on the converted invoice'; END IF;
SELECT coalesce(sum(amount),0) INTO paid FROM public.client_billing_payments WHERE document_id=d.id OR document_id=d.source_document_id;
IF paid+NEW.amount>(d.snapshot->'totals'->>'total')::numeric THEN RAISE EXCEPTION 'Payment exceeds outstanding balance'; END IF;
IF length(trim(NEW.method))=0 THEN RAISE EXCEPTION 'Enter the payment method'; END IF; NEW.created_by=auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER billing_payment_guard BEFORE INSERT ON public.client_billing_payments FOR EACH ROW EXECUTE FUNCTION public.guard_client_billing_payment();