ALTER TABLE public.client_contacts ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS client_contacts_site_idx ON public.client_contacts(site_id);
ALTER TABLE public.lookup_options ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT true;
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS pdf_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS note_presets jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.job_sheets
  ADD COLUMN IF NOT EXISTS special_notes text,
  ADD COLUMN IF NOT EXISTS special_notes_in_pdf boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS special_notes_in_email boolean NOT NULL DEFAULT false;
-- Only managers may approve/rename shared role lookups
DROP POLICY IF EXISTS "Update company options" ON public.lookup_options;
CREATE POLICY "Update company options" ON public.lookup_options FOR UPDATE TO authenticated
  USING ((NOT is_global) AND company_id = public.current_company_id() AND (public.is_company_manager() OR created_by_user_id = auth.uid()))
  WITH CHECK ((NOT is_global) AND company_id = public.current_company_id());