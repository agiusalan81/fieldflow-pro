CREATE OR REPLACE FUNCTION public.save_standby_roster(_start date, _rotation_days int, _per_shift int, _order uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid := public.current_company_id();
BEGIN
  IF _cid IS NULL OR NOT public.member_is_active(auth.uid()) OR NOT (public.has_company_role('admin'::user_role) OR public.has_company_role('supervisor'::user_role)) THEN
    RAISE EXCEPTION 'Not allowed to change the standby roster' USING ERRCODE = '42501';
  END IF;
  IF _rotation_days NOT IN (1,2,3,7,14) OR _per_shift < 1 THEN RAISE EXCEPTION 'Invalid roster settings'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_order) o WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = o AND u.company_id = _cid)) THEN
    RAISE EXCEPTION 'Roster contains people outside the company';
  END IF;
  -- Update only roster fields: an upsert fires payroll/branding INSERT guards
  -- even when the company settings already exist.
  UPDATE public.company_settings SET standby_start = _start,
    standby_rotation_days = _rotation_days, standby_per_shift = _per_shift,
    standby_order = _order WHERE company_id = _cid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company settings must be initialized by an office admin before saving the roster' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_standby_roster(date,int,int,uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_standby_roster(date,int,int,uuid[]) TO authenticated;