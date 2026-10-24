CREATE OR REPLACE FUNCTION public.dispatch_pending_work(_sheet uuid, _expected text, _dispatch jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.job_sheets; c uuid=public.current_company_id(); j uuid; lead_id uuid; assistant_id uuid; crew uuid[]; skills uuid[]; team integer; smart boolean; claim boolean; day date; priority_value text;
BEGIN
IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() OR NOT public.company_module_access(c,'core') THEN RAISE EXCEPTION 'Manager access required'; END IF;
SELECT * INTO s FROM public.job_sheets WHERE id=_sheet AND company_id=c FOR UPDATE;
IF NOT FOUND OR coalesce(trim(s.pending_works_future_jobs),'')='' THEN RAISE EXCEPTION 'Pending work not found'; END IF;
IF s.pending_status IS DISTINCT FROM _expected OR s.pending_status='done' THEN RAISE EXCEPTION 'This item changed. Refresh before dispatching.'; END IF;
IF s.pending_job_id IS NOT NULL THEN RAISE EXCEPTION 'This item already has a follow-up visit. Update the existing visit in Team dispatch.'; END IF;
IF _dispatch IS NULL OR jsonb_typeof(_dispatch)<>'object' THEN RAISE EXCEPTION 'Invalid dispatch'; END IF;
lead_id=nullif(_dispatch->>'tech','none')::uuid; assistant_id=nullif(_dispatch->>'assistant','none')::uuid;
SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO crew FROM jsonb_array_elements_text(coalesce(_dispatch->'crew','[]'::jsonb));
SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO skills FROM jsonb_array_elements_text(coalesce(_dispatch->'skills','[]'::jsonb));
team=coalesce((_dispatch->>'teamSize')::integer,1); claim=coalesce((_dispatch->>'open')::boolean,false); day=(_dispatch->>'scheduled_date')::date; priority_value=coalesce(_dispatch->>'priority','normal');
smart=public.company_module_access(c,'skills_dispatch');
IF day IS NULL OR priority_value NOT IN ('low','normal','high','urgent') OR length(coalesce(_dispatch->>'problem_summary',''))>2000 THEN RAISE EXCEPTION 'Invalid visit details'; END IF;
IF NOT smart AND (cardinality(skills)>0 OR cardinality(crew)>0 OR claim OR team>2) THEN RAISE EXCEPTION 'Skills & Smart Dispatch is not included in this plan'; END IF;
IF team<1 OR team>30 OR (lead_id IS NOT NULL)::integer+(assistant_id IS NOT NULL)::integer+cardinality(crew)>team OR (lead_id IS NULL AND (assistant_id IS NOT NULL OR cardinality(crew)>0)) THEN RAISE EXCEPTION 'Choose a lead and valid team size'; END IF;
IF EXISTS(SELECT 1 FROM unnest(array_remove(ARRAY[lead_id,assistant_id]||crew,NULL)) x GROUP BY x HAVING count(*)>1) THEN RAISE EXCEPTION 'Choose each team member only once'; END IF;
IF EXISTS(SELECT 1 FROM unnest(array_remove(ARRAY[lead_id,assistant_id]||crew,NULL)) x WHERE NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=x AND r.company_id=c AND r.role IN ('technician','supervisor','maintenance') AND public.member_is_active(r.user_id))) THEN RAISE EXCEPTION 'Choose active company field staff'; END IF;
IF EXISTS(SELECT 1 FROM unnest(skills) x WHERE NOT EXISTS(SELECT 1 FROM public.company_skills k WHERE k.id=x AND k.company_id=c AND NOT k.archived)) THEN RAISE EXCEPTION 'Choose active company skills'; END IF;
j=public.route_pending_work(_sheet,'scheduled',_expected,lead_id,day,'Dispatched follow-up visit');
UPDATE public.jobs SET secondary_technician_id=assistant_id, window_start=nullif(_dispatch->>'window_start','')::time, window_end=nullif(_dispatch->>'window_end','')::time, priority=priority_value, problem_summary=coalesce(nullif(_dispatch->>'problem_summary',''),problem_summary), required_team_size=team, open_to_claim=claim AND ((lead_id IS NOT NULL)::integer+(assistant_id IS NOT NULL)::integer+cardinality(crew)<team) WHERE id=j AND company_id=c;
INSERT INTO public.job_skills(job_id,skill_id,company_id,mandatory) SELECT j,x,c,true FROM (SELECT DISTINCT unnest(skills) x) q;
INSERT INTO public.job_crew(job_id,user_id,company_id) SELECT j,x,c FROM unnest(crew) x;
RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_pending_work(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dispatch_pending_work(uuid,text,jsonb) TO authenticated,service_role;