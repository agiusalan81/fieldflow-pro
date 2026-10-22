
CREATE OR REPLACE FUNCTION public.claim_open_job(_job uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.jobs; me uuid := auth.uid(); filled integer; slot text;
BEGIN
  IF me IS NULL OR NOT public.member_is_active(me) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO j FROM public.jobs WHERE id=_job AND company_id=public.current_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF NOT public.company_module_access(j.company_id,'skills_dispatch') THEN RAISE EXCEPTION 'Skills & Smart Dispatch is not included in this plan'; END IF;
  IF NOT j.open_to_claim THEN RAISE EXCEPTION 'This job is no longer open'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.shifts WHERE user_id=me AND ended_at IS NULL) THEN RAISE EXCEPTION 'Clock in before claiming a job'; END IF;
  IF me IN (j.assigned_technician_id, j.secondary_technician_id) OR EXISTS(SELECT 1 FROM public.job_crew WHERE job_id=_job AND user_id=me) THEN RAISE EXCEPTION 'You are already on this job'; END IF;
  IF EXISTS(SELECT 1 FROM public.job_skills js WHERE js.job_id=_job AND js.mandatory AND NOT EXISTS(SELECT 1 FROM public.member_skills ms WHERE ms.user_id=me AND ms.skill_id=js.skill_id)) THEN
    RAISE EXCEPTION 'You do not have the required skills for this job';
  END IF;
  filled := (j.assigned_technician_id IS NOT NULL)::int + (j.secondary_technician_id IS NOT NULL)::int + (SELECT count(*) FROM public.job_crew WHERE job_id=_job);
  IF filled >= j.required_team_size THEN UPDATE public.jobs SET open_to_claim=false WHERE id=_job; RAISE EXCEPTION 'All places on this job are taken'; END IF;
  IF j.assigned_technician_id IS NULL THEN UPDATE public.jobs SET assigned_technician_id=me WHERE id=_job; slot:='lead';
  ELSE INSERT INTO public.job_crew(job_id,user_id,company_id,added_by,claimed) VALUES(_job,me,j.company_id,me,true); slot:='crew'; END IF;
  IF filled + 1 >= j.required_team_size THEN UPDATE public.jobs SET open_to_claim=false WHERE id=_job; END IF;
  RETURN slot;
END $$;

-- Open jobs the caller is eligible to see (skills matched), with remaining places.
CREATE OR REPLACE FUNCTION public.open_jobs_for_me() RETURNS TABLE(id uuid, job_number integer, scheduled_date date, window_start time, window_end time, priority text, problem_summary text, client_name text, site_name text, required_team_size integer, places_left integer, skills text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT j.id, j.job_number, j.scheduled_date, j.window_start, j.window_end, j.priority, j.problem_summary, c.name, s.name, j.required_team_size,
    j.required_team_size - ((j.assigned_technician_id IS NOT NULL)::int + (j.secondary_technician_id IS NOT NULL)::int + (SELECT count(*) FROM public.job_crew x WHERE x.job_id=j.id)::int),
    COALESCE((SELECT array_agg(k.name ORDER BY k.name) FROM public.job_skills js JOIN public.company_skills k ON k.id=js.skill_id WHERE js.job_id=j.id),'{}')
  FROM public.jobs j LEFT JOIN public.clients c ON c.id=j.client_id LEFT JOIN public.sites s ON s.id=j.site_id
  WHERE j.company_id=public.current_company_id() AND j.open_to_claim AND public.member_is_active(auth.uid())
    AND public.company_module_access(j.company_id,'skills_dispatch')
    AND auth.uid() IS DISTINCT FROM j.assigned_technician_id AND auth.uid() IS DISTINCT FROM j.secondary_technician_id
    AND NOT EXISTS(SELECT 1 FROM public.job_crew x WHERE x.job_id=j.id AND x.user_id=auth.uid())
    AND NOT EXISTS(SELECT 1 FROM public.job_skills js WHERE js.job_id=j.id AND js.mandatory AND NOT EXISTS(SELECT 1 FROM public.member_skills ms WHERE ms.user_id=auth.uid() AND ms.skill_id=js.skill_id))
  ORDER BY j.scheduled_date, j.window_start NULLS LAST
$$;
REVOKE ALL ON FUNCTION public.open_jobs_for_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_jobs_for_me() TO authenticated;
