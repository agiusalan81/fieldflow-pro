DROP POLICY IF EXISTS "survey insert" ON public.site_surveys;
DROP POLICY IF EXISTS "survey update" ON public.site_surveys;
CREATE POLICY "survey insert" ON public.site_surveys FOR INSERT TO authenticated
 WITH CHECK (company_id=public.current_company_id() AND created_by=auth.uid() AND public.member_is_active(auth.uid()) AND public.company_module_access(company_id,'site_surveys'));
CREATE POLICY "survey update" ON public.site_surveys FOR UPDATE TO authenticated
 USING (company_id=public.current_company_id() AND (public.is_company_manager() OR reviewer_id=auth.uid() OR (created_by=auth.uid() AND status='draft')))
 WITH CHECK (company_id=public.current_company_id() AND public.company_module_access(company_id,'site_surveys'));