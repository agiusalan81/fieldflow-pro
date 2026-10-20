ALTER TABLE public.document_masters ADD COLUMN IF NOT EXISTS audience text[] NOT NULL DEFAULT '{technician,client}';
ALTER TABLE public.document_masters ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS audience text[] NOT NULL DEFAULT '{technician,client}';
ALTER TABLE public.document_masters ADD CONSTRAINT document_masters_audience_check CHECK (audience <@ ARRAY['technician','client']::text[]);
ALTER TABLE public.company_documents ADD CONSTRAINT company_documents_audience_check CHECK (audience <@ ARRAY['technician','client']::text[]);
ALTER TABLE public.document_masters ADD CONSTRAINT document_masters_sections_array CHECK (jsonb_typeof(sections)='array');

DROP POLICY IF EXISTS masters_read ON public.document_masters;
CREATE POLICY masters_read ON public.document_masters FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND (public.is_company_manager() OR (state='active' AND 'technician'=ANY(audience))));
DROP POLICY IF EXISTS "tenant read" ON public.company_documents;
CREATE POLICY "tenant read" ON public.company_documents FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND (public.is_company_manager() OR public.my_role()='superuser'::app_role OR 'technician'=ANY(audience)));

CREATE OR REPLACE FUNCTION public.guard_document_master() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF OLD.state<>'draft' OR EXISTS(SELECT 1 FROM public.document_attachments WHERE master_id=OLD.id) OR EXISTS(SELECT 1 FROM public.contract_types WHERE base_document_id=OLD.id OR checklist_document_id=OLD.id) THEN RAISE EXCEPTION 'This document is in use or was published; archive it instead'; END IF; RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND OLD.state<>'draft' AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.items IS DISTINCT FROM OLD.items OR NEW.sections IS DISTINCT FROM OLD.sections OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.trade IS DISTINCT FROM OLD.trade OR NEW.name IS DISTINCT FROM OLD.name OR NEW.state='draft') THEN RAISE EXCEPTION 'Clone a published document before editing'; END IF;
 IF NEW.source_document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_documents WHERE id=NEW.source_document_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Source is outside this company'; END IF;
 IF NEW.cloned_from IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.document_masters WHERE id=NEW.cloned_from AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Clone is outside this company'; END IF;
 IF NEW.state='active' AND (trim(NEW.name)='' OR (NEW.kind='checklist' AND cardinality(NEW.items)=0) OR (NEW.kind<>'checklist' AND trim(NEW.body)='' AND jsonb_array_length(NEW.sections)=0)) THEN RAISE EXCEPTION 'Complete the document before publishing'; END IF;
 NEW.updated_at=now(); RETURN NEW; END $$;