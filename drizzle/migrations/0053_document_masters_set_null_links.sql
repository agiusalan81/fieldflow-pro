ALTER TABLE public.document_masters DROP CONSTRAINT IF EXISTS document_masters_source_document_id_fkey;
ALTER TABLE public.document_masters ADD CONSTRAINT document_masters_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.company_documents(id) ON DELETE SET NULL;
ALTER TABLE public.document_masters DROP CONSTRAINT IF EXISTS document_masters_cloned_from_fkey;
ALTER TABLE public.document_masters ADD CONSTRAINT document_masters_cloned_from_fkey FOREIGN KEY (cloned_from) REFERENCES public.document_masters(id) ON DELETE SET NULL;