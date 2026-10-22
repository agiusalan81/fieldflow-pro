
CREATE TABLE public.company_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  category text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX company_skills_name_uq ON public.company_skills(company_id, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_skills TO authenticated;
GRANT ALL ON public.company_skills TO service_role;
ALTER TABLE public.company_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read skills" ON public.company_skills FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "managers write skills" ON public.company_skills FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager() AND public.company_module_access(company_id,'skills_dispatch'))
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager() AND public.company_module_access(company_id,'skills_dispatch'));

CREATE TABLE public.member_skills (
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.company_skills(id) ON DELETE CASCADE,
  assigned_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);
GRANT SELECT, INSERT, DELETE ON public.member_skills TO authenticated;
GRANT ALL ON public.member_skills TO service_role;
ALTER TABLE public.member_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read member skills" ON public.member_skills FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "managers assign skills" ON public.member_skills FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager() AND public.company_module_access(company_id,'skills_dispatch')
    AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=user_id AND u.company_id=company_id)
    AND EXISTS(SELECT 1 FROM public.company_skills s WHERE s.id=skill_id AND s.company_id=company_id));
CREATE POLICY "managers remove skills" ON public.member_skills FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager());

ALTER TABLE public.jobs ADD COLUMN required_team_size integer NOT NULL DEFAULT 1 CHECK (required_team_size BETWEEN 1 AND 30);
ALTER TABLE public.jobs ADD COLUMN open_to_claim boolean NOT NULL DEFAULT false;

CREATE TABLE public.job_skills (
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.company_skills(id) ON DELETE CASCADE,
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  mandatory boolean NOT NULL DEFAULT true,
  PRIMARY KEY (job_id, skill_id)
);
GRANT SELECT, INSERT, DELETE ON public.job_skills TO authenticated;
GRANT ALL ON public.job_skills TO service_role;
ALTER TABLE public.job_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read job skills" ON public.job_skills FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "managers write job skills" ON public.job_skills FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager() AND public.company_module_access(company_id,'skills_dispatch')
    AND EXISTS(SELECT 1 FROM public.jobs j WHERE j.id=job_id AND j.company_id=company_id));
CREATE POLICY "managers delete job skills" ON public.job_skills FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

-- Additional crew members beyond the lead and the first assistant.
CREATE TABLE public.job_crew (
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  added_by uuid DEFAULT auth.uid(),
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.job_crew TO authenticated;
GRANT ALL ON public.job_crew TO service_role;
ALTER TABLE public.job_crew ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read crew" ON public.job_crew FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "managers add crew" ON public.job_crew FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager() AND public.company_module_access(company_id,'skills_dispatch')
    AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=user_id AND u.company_id=company_id)
    AND EXISTS(SELECT 1 FROM public.jobs j WHERE j.id=job_id AND j.company_id=company_id AND j.assigned_technician_id IS DISTINCT FROM user_id AND j.secondary_technician_id IS DISTINCT FROM user_id));
CREATE POLICY "managers remove crew" ON public.job_crew FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

-- Team size above 2 and open claiming need the module.
CREATE OR REPLACE FUNCTION public.guard_job_dispatch_module() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (NEW.required_team_size > 2 OR NEW.open_to_claim)
     AND (TG_OP='INSERT' OR NEW.required_team_size IS DISTINCT FROM OLD.required_team_size OR NEW.open_to_claim IS DISTINCT FROM OLD.open_to_claim)
     AND auth.uid() IS NOT NULL
     AND NOT public.company_module_access(NEW.company_id,'skills_dispatch') THEN
    RAISE EXCEPTION 'Skills & Smart Dispatch is not included in this plan';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER jobs_guard_dispatch_module BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_job_dispatch_module();

-- Atomic first-come claim of a place on an open job.
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
  ELSIF j.secondary_technician_id IS NULL THEN UPDATE public.jobs SET secondary_technician_id=me WHERE id=_job; slot:='assistant';
  ELSE INSERT INTO public.job_crew(job_id,user_id,company_id,added_by,claimed) VALUES(_job,me,j.company_id,me,true); slot:='crew'; END IF;
  IF filled + 1 >= j.required_team_size THEN UPDATE public.jobs SET open_to_claim=false WHERE id=_job; END IF;
  RETURN slot;
END $$;
REVOKE ALL ON FUNCTION public.claim_open_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_open_job(uuid) TO authenticated;
