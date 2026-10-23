CREATE OR REPLACE FUNCTION public.get_equipment_report_target(_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('reference', a.reference_number, 'category', a.asset_category)
  FROM public.equipment_report_links l
  JOIN public.assets a ON a.id = l.asset_id AND a.company_id = l.company_id
  WHERE _token ~ '^[a-f0-9]{64}$'
    AND l.token_hash = encode(sha256(_token::bytea), 'hex')
    AND l.revoked_at IS NULL
    AND public.company_module_access(l.company_id, 'core')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_equipment_report_target(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_equipment_report_target(text) TO anon, authenticated;
ALTER POLICY "Manager delete" ON public.job_sheets USING (company_id = public.current_company_id() AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'superuser'::public.app_role)));
