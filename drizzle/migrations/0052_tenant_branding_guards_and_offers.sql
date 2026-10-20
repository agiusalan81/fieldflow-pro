CREATE OR REPLACE FUNCTION public.branding_offers() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.name,'kind',c.kind,'modules',c.modules,'state',c.state)),'[]'::jsonb) FROM public.platform_catalog c WHERE c.product_id=public.company_app_product_id() AND c.state='active' AND public.member_is_active(auth.uid()); $$;
REVOKE ALL ON FUNCTION public.branding_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.branding_offers() TO authenticated, service_role;
CREATE POLICY "Tenant branding reads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='company-branding' AND (storage.foldername(name))[1]=public.current_company_id()::text AND public.member_is_active(auth.uid()));
CREATE POLICY "Office branding uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='company-branding' AND (storage.foldername(name))[1]=public.current_company_id()::text AND public.has_company_role('admin') AND ((storage.foldername(name))[2]='fonts' AND public.company_module_access(public.current_company_id(),'branding_custom_fonts') OR (storage.foldername(name))[2]='backgrounds' AND (public.company_module_access(public.current_company_id(),'branding_advanced') OR public.company_module_access(public.current_company_id(),'branding_documents'))));
CREATE OR REPLACE FUNCTION public.guard_branding_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prior_theme jsonb; prior_pdf jsonb; feature text; keys text[]; oldpart jsonb; newpart jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 prior_theme=CASE WHEN TG_OP='UPDATE' THEN coalesce(OLD.theme,'{}'::jsonb) ELSE '{}'::jsonb END;
 prior_pdf=CASE WHEN TG_OP='UPDATE' THEN coalesce(OLD.pdf_template,'{}'::jsonb) ELSE '{}'::jsonb END;
 IF NEW.theme IS NOT DISTINCT FROM prior_theme AND NEW.pdf_template IS NOT DISTINCT FROM prior_pdf THEN RETURN NEW; END IF;
 IF NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT public.has_company_role('admin') THEN RAISE EXCEPTION 'Only active office admins may change company branding'; END IF;
 FOREACH feature IN ARRAY ARRAY['branding_advanced','branding_custom_fonts','branding_fonts','branding_documents','branding_industry'] LOOP
  IF feature='branding_advanced' THEN
   oldpart=coalesce(prior_theme->'appearance','{}') - 'industryPreset'; newpart=coalesce(NEW.theme->'appearance','{}') - 'industryPreset';
  ELSIF feature='branding_custom_fonts' THEN
   oldpart=jsonb_build_array(prior_theme->'customFontPath',prior_theme->'customFontName',prior_pdf->'fontPath',prior_pdf->'fontName'); newpart=jsonb_build_array(NEW.theme->'customFontPath',NEW.theme->'customFontName',NEW.pdf_template->'fontPath',NEW.pdf_template->'fontName');
  ELSIF feature='branding_industry' THEN
   oldpart=prior_theme#>'{appearance,industryPreset}'; newpart=NEW.theme#>'{appearance,industryPreset}';
  ELSIF feature='branding_documents' THEN
   keys=ARRAY['order','hidden','stylePreset','accentColor','frame','backgroundPath','fieldBackground','fieldText']; SELECT coalesce(jsonb_object_agg(k,prior_pdf->k),'{}') INTO oldpart FROM unnest(keys) k; SELECT coalesce(jsonb_object_agg(k,NEW.pdf_template->k),'{}') INTO newpart FROM unnest(keys) k;
  ELSE
   oldpart=jsonb_build_array(prior_pdf->'documentFont',prior_theme#>'{headers,font}',prior_theme#>'{fields,font}'); newpart=jsonb_build_array(NEW.pdf_template->'documentFont',NEW.theme#>'{headers,font}',NEW.theme#>'{fields,font}');
  END IF;
  IF oldpart IS DISTINCT FROM newpart AND NOT public.company_module_access(NEW.company_id,feature) THEN RAISE EXCEPTION 'This branding option requires an included tier or pack: %', feature; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER company_settings_guard_branding BEFORE INSERT OR UPDATE OF theme,pdf_template ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.guard_branding_settings();