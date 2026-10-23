CREATE OR REPLACE FUNCTION public.guard_user_privileges() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND pg_trigger_depth()=1 AND NOT public.has_company_role('admin') AND (
 NEW.role IS DISTINCT FROM OLD.role OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.full_name IS DISTINCT FROM OLD.full_name OR NEW.email IS DISTINCT FROM OLD.email OR NEW.language_preference IS DISTINCT FROM OLD.language_preference OR NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.technician_initials IS DISTINCT FROM OLD.technician_initials OR
 (NEW.signature_on_file IS DISTINCT FROM OLD.signature_on_file AND NOT (OLD.id=auth.uid() AND OLD.company_id=public.current_company_id() AND (public.has_role(auth.uid(),'technician') OR public.has_role(auth.uid(),'supervisor')) AND NEW.signature_on_file IS NOT NULL AND length(NEW.signature_on_file)<=200000 AND NEW.signature_on_file ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$')))
 THEN RAISE EXCEPTION 'Only admins can change these profile details'; END IF;
 IF auth.uid() IS NOT NULL AND pg_trigger_depth()=1 AND NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'Change roles from Team settings'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.save_my_staff_signature(_signature text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_company_id() IS NULL OR NOT (public.has_role(auth.uid(),'technician') OR public.has_role(auth.uid(),'supervisor')) THEN RAISE EXCEPTION 'Only active technicians and supervisors can save their signature'; END IF;
 IF _signature IS NULL OR length(_signature)>200000 OR _signature !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' THEN RAISE EXCEPTION 'Draw a valid PNG signature'; END IF;
 UPDATE public.users SET signature_on_file=_signature WHERE id=auth.uid() AND company_id=public.current_company_id();
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_my_staff_signature(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_staff_signature(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.fieldbridge_public_legal() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('legal_name',l.legal_name,'registration_number',l.registration_number,'vat_number',l.vat_number,'registered_address',l.registered_address,'country',l.country,'privacy_email',l.privacy_email)
 FROM public.platform_legal_profiles l JOIN public.platform_products p ON p.id=l.product_id WHERE p.slug='fieldbridge' AND p.active LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.fieldbridge_public_legal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fieldbridge_public_legal() TO anon,authenticated;
COMMENT ON FUNCTION public.fieldbridge_public_legal() IS 'Only published business identification and privacy contact for the active FieldBridge product; underlying HQ legal profile remains owner-only.';