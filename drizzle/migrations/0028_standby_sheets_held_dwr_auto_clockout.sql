ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS dwr_held boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_close_note text;

-- Mirrors standbyFor() in src/lib/dwr.ts: rotation blocks, M per shift, then accepted swaps.
CREATE OR REPLACE FUNCTION public.is_on_standby(_user uuid, _date date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; n int; per int; blk int; first int; ids uuid[] := '{}'; k int; sw record;
BEGIN
  SELECT cs.* INTO s FROM public.company_settings cs JOIN public.users u ON u.company_id = cs.company_id WHERE u.id = _user;
  IF NOT FOUND THEN RETURN false; END IF;
  n := coalesce(array_length(s.standby_order, 1), 0);
  IF n = 0 THEN RETURN false; END IF;
  per := greatest(1, least(s.standby_per_shift, n));
  blk := floor((_date - s.standby_start)::numeric / greatest(1, s.standby_rotation_days));
  first := (((blk * per) % n) + n) % n;
  FOR k IN 0..per-1 LOOP ids := ids || s.standby_order[((first + k) % n) + 1]; END LOOP;
  FOR sw IN SELECT requester_id, target_id FROM public.standby_swaps WHERE company_id = s.company_id AND swap_date = _date AND status = 'accepted' ORDER BY created_at LOOP
    IF sw.requester_id = ANY(ids) AND NOT sw.target_id = ANY(ids) THEN ids := array_replace(ids, sw.requester_id, sw.target_id); END IF;
  END LOOP;
  RETURN _user = ANY(ids);
END $$;
GRANT EXECUTE ON FUNCTION public.is_on_standby(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.require_clock_in_for_sheet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.shifts WHERE user_id = auth.uid() AND shift_type = 'shift' AND ended_at IS NULL)
    AND NOT public.is_on_standby(auth.uid(), CURRENT_DATE)
    AND NOT public.is_on_standby(auth.uid(), CURRENT_DATE - 1)
  THEN
    RAISE EXCEPTION 'Clock in before starting a job sheet';
  END IF;
  RETURN NEW;
END $$;