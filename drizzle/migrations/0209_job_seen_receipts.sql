CREATE TABLE public.job_seen_receipts (
 job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,user_id)
);
GRANT SELECT ON public.job_seen_receipts TO authenticated;
GRANT ALL ON public.job_seen_receipts TO service_role;
ALTER TABLE public.job_seen_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Office and own receipts" ON public.job_seen_receipts FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND (user_id=auth.uid() OR public.member_dispatch_can()));
CREATE OR REPLACE FUNCTION public.mark_job_seen(_job uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.jobs; stamp timestamptz;
BEGIN
 SELECT * INTO j FROM public.jobs WHERE id=_job AND company_id=public.current_company_id() FOR SHARE;
 IF NOT FOUND OR NOT public.member_is_active(auth.uid()) OR NOT public.is_dispatchable_member(auth.uid(),j.company_id) THEN RAISE EXCEPTION 'Job is not available to this fieldworker'; END IF;
 IF NOT (j.assigned_technician_id=auth.uid() OR j.secondary_technician_id=auth.uid() OR EXISTS(SELECT 1 FROM public.job_crew c WHERE c.job_id=j.id AND c.user_id=auth.uid())) IS TRUE AND NOT EXISTS(SELECT 1 FROM public.open_jobs_for_me() o WHERE o.id=j.id) THEN RAISE EXCEPTION 'Job is not available to this fieldworker'; END IF;
 INSERT INTO public.job_seen_receipts(job_id,user_id,company_id) VALUES(j.id,auth.uid(),j.company_id) ON CONFLICT(job_id,user_id) DO NOTHING;
 SELECT seen_at INTO stamp FROM public.job_seen_receipts WHERE job_id=j.id AND user_id=auth.uid();
 RETURN stamp;
END $$;
REVOKE ALL ON FUNCTION public.mark_job_seen(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_job_seen(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.job_seen_readers(_job uuid) RETURNS TABLE(user_id uuid,full_name text,seen_at timestamptz,assigned boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.user_id,u.full_name,r.seen_at,(r.user_id=j.assigned_technician_id OR r.user_id=j.secondary_technician_id OR EXISTS(SELECT 1 FROM public.job_crew c WHERE c.job_id=j.id AND c.user_id=r.user_id)) IS TRUE
 FROM public.job_seen_receipts r JOIN public.jobs j ON j.id=r.job_id JOIN public.users u ON u.id=r.user_id AND u.company_id=r.company_id
 WHERE j.id=_job AND j.company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND public.member_dispatch_can() ORDER BY r.seen_at,r.user_id;
$$;
REVOKE ALL ON FUNCTION public.job_seen_readers(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.job_seen_readers(uuid) TO authenticated;