CREATE OR REPLACE FUNCTION public.convert_client_billing(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.client_billing_documents; result uuid; BEGIN
IF NOT public.client_billing_can() THEN RAISE EXCEPTION 'Office access required'; END IF;
SELECT * INTO d FROM public.client_billing_documents WHERE id=_id AND company_id=public.current_company_id() FOR UPDATE;
IF d.id IS NULL OR d.issued_at IS NULL OR d.kind='invoice' THEN RAISE EXCEPTION 'Only issued proformas or payment requests can convert'; END IF;
SELECT id INTO result FROM public.client_billing_documents WHERE source_document_id=d.id; IF result IS NOT NULL THEN RETURN result; END IF;
INSERT INTO public.client_billing_documents(kind,client_id,source_document_id,data) VALUES('invoice',d.client_id,d.id,d.data||jsonb_build_object('issue_date',current_date::text,'due_date',greatest(current_date,coalesce((d.data->>'due_date')::date,current_date))::text)) RETURNING id INTO result; RETURN result; END $$;
CREATE OR REPLACE FUNCTION public.guard_billing_conversion_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE src public.client_billing_documents; paid numeric; BEGIN
IF NEW.source_document_id IS NOT NULL THEN
SELECT * INTO src FROM public.client_billing_documents WHERE id=NEW.source_document_id;
IF NEW.kind<>'invoice' OR NEW.client_id IS DISTINCT FROM src.client_id THEN RAISE EXCEPTION 'Invoice conversion must retain its source client'; END IF;
IF NEW.issued_at IS NOT NULL THEN SELECT coalesce(sum(amount),0) INTO paid FROM public.client_billing_payments WHERE document_id=src.id; IF paid>(NEW.snapshot->'totals'->>'total')::numeric THEN RAISE EXCEPTION 'Invoice total cannot be below payments already received'; END IF; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER billing_conversion_identity BEFORE INSERT OR UPDATE ON public.client_billing_documents FOR EACH ROW EXECUTE FUNCTION public.guard_billing_conversion_identity();