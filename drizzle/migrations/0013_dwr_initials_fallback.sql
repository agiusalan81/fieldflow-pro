CREATE OR REPLACE FUNCTION public.user_initials(_full_name text, _initials text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT upper(coalesce(nullif(btrim(_initials), ''),
    left((SELECT string_agg(left(w, 1), '') FROM regexp_split_to_table(btrim(_full_name), '\s+') w), 3)))
$$;

CREATE OR REPLACE FUNCTION public.dwr_sheet_entries(_user uuid, _date date)
RETURNS TABLE(jobsheet_id uuid, jobsheet_number text, client text, site text, time_in time, time_out time, travel numeric, lead_name text, assisting boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.jobsheet_number, c.name, coalesce(si.name, si.address), l.time_in, l.time_out, l.traveling_time_hours,
         lu.full_name, (s.assigned_technician_id IS DISTINCT FROM _user)
  FROM public.jobsheet_time_logs l
  JOIN public.job_sheets s ON s.id = l.jobsheet_id
  JOIN public.users u ON u.id = _user AND u.company_id = s.company_id
  LEFT JOIN public.clients c ON c.id = s.client_id
  LEFT JOIN public.sites si ON si.id = s.site_id
  LEFT JOIN public.users lu ON lu.id = s.assigned_technician_id
  WHERE l.log_date = _date
    AND s.company_id = public.current_company_id()
    AND (_user = auth.uid() OR public.is_company_manager())
    AND (s.assigned_technician_id = _user
         OR public.user_initials(u.full_name, u.technician_initials) = ANY (SELECT upper(x) FROM unnest(l.technician_initials) x))
  ORDER BY l.time_in NULLS LAST
$$;