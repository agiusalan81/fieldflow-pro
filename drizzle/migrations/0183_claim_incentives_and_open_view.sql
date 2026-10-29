ALTER TABLE public.company_settings ADD COLUMN claim_incentive_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.company_settings ADD COLUMN claim_incentive_cents integer NOT NULL DEFAULT 0 CHECK (claim_incentive_cents >= 0 AND claim_incentive_cents <= 100000000);
ALTER TABLE public.jobs ADD COLUMN claim_incentive_cents integer NOT NULL DEFAULT 0 CHECK (claim_incentive_cents >= 0 AND claim_incentive_cents <= 100000000);
CREATE TABLE public.job_claim_incentives (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), job_id uuid NOT NULL REFERENCES public.jobs(id), user_id uuid NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents > 0), claimed_at timestamptz NOT NULL DEFAULT now(), earned_at timestamptz, sheet_id uuid REFERENCES public.job_sheets(id), UNIQUE(job_id,user_id));
GRANT SELECT ON public.job_claim_incentives TO authenticated;
GRANT ALL ON public.job_claim_incentives TO service_role;
ALTER TABLE public.job_claim_incentives ENABLE ROW LEVEL SECURITY;
CREATE POLICY incentive_read ON public.job_claim_incentives FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND (user_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')));
CREATE FUNCTION public.guard_claim_incentive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_TABLE_NAME='company_settings' THEN
 IF (TG_OP='INSERT' AND (NEW.claim_incentive_enabled OR NEW.claim_incentive_cents<>0)) OR (TG_OP='UPDATE' AND (NEW.claim_incentive_enabled IS DISTINCT FROM OLD.claim_incentive_enabled OR NEW.claim_incentive_cents IS DISTINCT FROM OLD.claim_incentive_cents)) THEN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) THEN RAISE EXCEPTION 'Office access required for claim incentives'; END IF; END IF;
ELSE
 IF TG_OP='INSERT' THEN IF NEW.claim_incentive_cents=0 THEN SELECT CASE WHEN claim_incentive_enabled THEN claim_incentive_cents ELSE 0 END INTO NEW.claim_incentive_cents FROM public.company_settings WHERE company_id=NEW.company_id; NEW.claim_incentive_cents=coalesce(NEW.claim_incentive_cents,0); END IF;
 ELSIF NEW.claim_incentive_cents IS DISTINCT FROM OLD.claim_incentive_cents THEN
 IF NOT public.member_dispatch_can() THEN RAISE EXCEPTION 'Dispatch access required'; END IF;
 IF EXISTS(SELECT 1 FROM public.job_claim_incentives WHERE job_id=NEW.id) THEN RAISE EXCEPTION 'Bonus is frozen after the first claim'; END IF; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER incentive_settings_guard BEFORE INSERT OR UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.guard_claim_incentive();
CREATE TRIGGER incentive_job_guard BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_claim_incentive();
DO $$ DECLARE f text; BEGIN
f=pg_get_functiondef('public.claim_open_job(uuid)'::regprocedure);
f=replace(f,'RETURN slot;', 'IF j.claim_incentive_cents > 0 THEN INSERT INTO public.job_claim_incentives(company_id,job_id,user_id,amount_cents) VALUES(j.company_id,j.id,me,j.claim_incentive_cents) ON CONFLICT(job_id,user_id) DO NOTHING; END IF; RETURN slot;'); EXECUTE f;
f=pg_get_functiondef('public.open_jobs_for_me()'::regprocedure);
f=replace(f,'AND public.is_dispatchable_member(auth.uid(),j.company_id) AND EXISTS(SELECT 1 FROM public.shifts sh WHERE sh.user_id=auth.uid() AND sh.company_id=j.company_id AND sh.ended_at IS NULL AND sh.shift_type IN (''shift'',''standby''))','AND (public.is_dispatchable_member(auth.uid(),j.company_id) OR public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''superuser''))');
f=replace(f,'AND NOT EXISTS(SELECT 1 FROM public.job_skills js WHERE js.job_id=j.id AND js.mandatory AND NOT EXISTS(SELECT 1 FROM public.member_skills ms WHERE ms.user_id=auth.uid() AND ms.skill_id=js.skill_id))','AND (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''superuser'') OR NOT EXISTS(SELECT 1 FROM public.job_skills js WHERE js.job_id=j.id AND js.mandatory AND NOT EXISTS(SELECT 1 FROM public.member_skills ms WHERE ms.user_id=auth.uid() AND ms.skill_id=js.skill_id)))'); EXECUTE f;
END $$;
CREATE FUNCTION public.earn_claim_incentive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN UPDATE public.job_claim_incentives i SET earned_at=now(),sheet_id=NEW.id WHERE i.job_id=NEW.job_id AND i.company_id=NEW.company_id AND i.earned_at IS NULL AND (i.user_id=NEW.assigned_technician_id OR EXISTS(SELECT 1 FROM public.jobs j WHERE j.id=NEW.job_id AND (i.user_id=j.assigned_technician_id OR i.user_id=j.secondary_technician_id)) OR EXISTS(SELECT 1 FROM public.job_crew c WHERE c.job_id=NEW.job_id AND c.user_id=i.user_id)); END IF; RETURN NEW; END $$;
CREATE TRIGGER completed_claim_incentive AFTER INSERT OR UPDATE ON public.job_sheets FOR EACH ROW EXECUTE FUNCTION public.earn_claim_incentive();
CREATE FUNCTION public.open_job_incentives() RETURNS TABLE(job_id uuid,amount_cents integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT j.id,j.claim_incentive_cents FROM public.jobs j JOIN public.open_jobs_for_me() o ON o.id=j.id WHERE j.company_id=public.current_company_id(); $$;
REVOKE ALL ON FUNCTION public.open_job_incentives() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.open_job_incentives() TO authenticated;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='jobs') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs; END IF; IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='job_crew') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.job_crew; END IF; END $$;
COMMENT ON TABLE public.job_claim_incentives IS 'Immutable per-claim euro-cent snapshots. Earned on completed work; office review ledger, not automatic payroll payment.';