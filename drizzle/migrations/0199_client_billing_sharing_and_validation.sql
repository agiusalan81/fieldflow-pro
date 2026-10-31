CREATE OR REPLACE FUNCTION public.issue_client_billing(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.client_billing_documents; cfg public.client_billing_settings; c public.clients; co public.companies; cs public.company_settings; f jsonb; n bigint; ref text; totals jsonb; BEGIN
IF NOT public.client_billing_can() THEN RAISE EXCEPTION 'Office access required'; END IF;
SELECT * INTO d FROM public.client_billing_documents WHERE id=_id AND company_id=public.current_company_id() FOR UPDATE; IF d.id IS NULL THEN RAISE EXCEPTION 'Document unavailable'; END IF; IF d.issued_at IS NOT NULL THEN RETURN d.id; END IF;
IF d.client_id IS NULL OR jsonb_array_length(d.data->'lines')=0 OR length(trim(coalesce(d.data->>'title','')))=0 THEN RAISE EXCEPTION 'Enter a client, title and at least one line'; END IF;
IF coalesce(d.data->>'issue_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(d.data->>'due_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR (d.data->>'due_date')::date<(d.data->>'issue_date')::date THEN RAISE EXCEPTION 'Check issue and due dates'; END IF;
IF coalesce((d.data->>'deposit_pct')::numeric,0) NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Deposit must be between zero and 100 percent'; END IF;
IF coalesce((d.data->>'tax_exempt')::boolean,false) AND EXISTS(SELECT 1 FROM jsonb_array_elements(d.data->'lines') l WHERE (l->>'vat')::numeric<>0) THEN RAISE EXCEPTION 'Non-VAT documents cannot charge VAT'; END IF;
SELECT * INTO cfg FROM public.client_billing_settings WHERE company_id=d.company_id;
SELECT * INTO c FROM public.clients WHERE id=d.client_id; SELECT * INTO co FROM public.companies WHERE id=d.company_id; SELECT * INTO cs FROM public.company_settings WHERE company_id=d.company_id;
IF length(trim(coalesce(cs.company_address,'')))=0 THEN RAISE EXCEPTION 'Set your company address before issuing'; END IF;
IF d.kind='invoice' AND length(trim(coalesce(cs.vat_number,'')))=0 AND NOT coalesce((d.data->>'tax_exempt')::boolean,false) THEN RAISE EXCEPTION 'Set your VAT number or explicitly confirm non-VAT registration'; END IF;
f=cfg.formats->d.kind; IF length(coalesce(f->>'prefix',''))>30 OR coalesce((f->>'padding')::int,5) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid numbering format'; END IF;
totals=public.customer_quote_totals(d.data->'lines');
INSERT INTO public.company_number_counters(company_id,kind,next_value) VALUES(d.company_id,CASE WHEN d.kind='invoice' THEN 'invoice' ELSE 'billing_'||d.kind END,2) ON CONFLICT(company_id,kind) DO UPDATE SET next_value=public.company_number_counters.next_value+1 RETURNING next_value-1 INTO n;
ref=coalesce(f->>'prefix',CASE d.kind WHEN 'proforma' THEN 'PRO-' WHEN 'payment_request' THEN 'PAY-' ELSE 'INV-' END)||lpad(n::text,greatest(length(n::text),coalesce((f->>'padding')::int,5)),'0');
PERFORM set_config('app.billing_issue',d.id::text,true);
UPDATE public.client_billing_documents SET reference=ref,issued_at=now(),snapshot=jsonb_build_object('kind',d.kind,'reference',ref,'document',d.data,'totals',totals,'currency',cs.currency,'company',jsonb_build_object('name',co.name,'address',cs.company_address,'vat',cs.vat_number,'logo',cs.logo_data),'client',jsonb_build_object('name',c.name,'address',c.billing_address),'source_document_id',d.source_document_id) WHERE id=d.id;
RETURN d.id; END $$;
CREATE TABLE public.client_billing_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES public.companies(id),document_id uuid NOT NULL REFERENCES public.client_billing_documents(id),token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,UPDATE ON public.client_billing_links TO authenticated; GRANT ALL ON public.client_billing_links TO service_role;
ALTER TABLE public.client_billing_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_links_office ON public.client_billing_links FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.client_billing_can()) WITH CHECK(company_id=public.current_company_id() AND public.client_billing_can());
CREATE OR REPLACE FUNCTION public.create_client_billing_link(_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ DECLARE d public.client_billing_documents; token text; BEGIN
IF NOT public.client_billing_can() OR NOT public.company_module_access(public.current_company_id(),'core') THEN RAISE EXCEPTION 'Office billing access required'; END IF;
SELECT * INTO d FROM public.client_billing_documents WHERE id=_id AND company_id=public.current_company_id() AND issued_at IS NOT NULL; IF d.id IS NULL THEN RAISE EXCEPTION 'Issue the document first'; END IF;
token=encode(gen_random_bytes(32),'hex'); INSERT INTO public.client_billing_links(company_id,document_id,token_hash) VALUES(d.company_id,d.id,encode(digest(token,'sha256'),'hex')); RETURN token; END $$;
GRANT EXECUTE ON FUNCTION public.create_client_billing_link(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.read_client_billing(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ DECLARE result jsonb; BEGIN
IF _token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
SELECT d.snapshot INTO result FROM public.client_billing_links l JOIN public.client_billing_documents d ON d.id=l.document_id AND d.company_id=l.company_id WHERE l.token_hash=encode(digest(_token,'sha256'),'hex') AND l.revoked_at IS NULL AND l.expires_at>now() AND d.issued_at IS NOT NULL; RETURN result; END $$;
GRANT EXECUTE ON FUNCTION public.read_client_billing(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.revoke_client_billing_links(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.client_billing_can() THEN RAISE EXCEPTION 'Office access required'; END IF; UPDATE public.client_billing_links SET revoked_at=now() WHERE document_id=_id AND company_id=public.current_company_id(); END $$;
GRANT EXECUTE ON FUNCTION public.revoke_client_billing_links(uuid) TO authenticated;