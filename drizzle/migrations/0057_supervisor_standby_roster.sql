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
  INSERT INTO public.company_settings (company_id, standby_start, standby_rotation_days, standby_per_shift, standby_order)
  VALUES (_cid, _start, _rotation_days, _per_shift, _order)
  ON CONFLICT (company_id) DO UPDATE SET standby_start = EXCLUDED.standby_start, standby_rotation_days = EXCLUDED.standby_rotation_days, standby_per_shift = EXCLUDED.standby_per_shift, standby_order = EXCLUDED.standby_order;
END $$;
REVOKE ALL ON FUNCTION public.save_standby_roster(date,int,int,uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_standby_roster(date,int,int,uuid[]) TO authenticated;