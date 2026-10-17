CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  category text NOT NULL CHECK (category IN ('checklist','contract','terms','other')),
  name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  notes text,
  uploaded_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read" ON public.company_documents FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "office insert" ON public.company_documents FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "office update" ON public.company_documents FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "office delete" ON public.company_documents FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND (public.is_company_manager() OR public.my_role() = 'superuser'));

CREATE POLICY "tenant read files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'company-documents' AND (storage.foldername(name))[1] = public.current_company_id()::text);
CREATE POLICY "office upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-documents' AND (storage.foldername(name))[1] = public.current_company_id()::text AND public.is_company_manager());
CREATE POLICY "office delete files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-documents' AND (storage.foldername(name))[1] = public.current_company_id()::text AND (public.is_company_manager() OR public.my_role() = 'superuser'));