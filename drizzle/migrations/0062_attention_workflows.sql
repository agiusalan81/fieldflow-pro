CREATE TABLE public.pending_work_actions (sheet_id uuid PRIMARY KEY REFERENCES public.job_sheets(id) ON DELETE CASCADE, company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id), action text NOT NULL DEFAULT 'open', assigned_to uuid, note text NOT NULL DEFAULT '', updated_by uuid DEFAULT auth.uid(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.pending_work_actions TO authenticated; GRANT ALL ON public.pending_work_actions TO service_role;
ALTER TABLE public.pending_work_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pending_actions_read ON public.pending_work_actions FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()));
CREATE OR REPLACE FUNCTION public.route_pending_work(_sheet uuid,_action text,_expected text,_assignee uuid DEFAULT NULL,_date date DEFAULT NULL,_note text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.job_sheets; a text; j uuid; c uuid=public.current_company_id(); BEGIN
IF NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() OR NOT public.company_module_access(c,'core') THEN RAISE EXCEPTION 'Manager access required'; END IF;
IF _action NOT IN ('open','quote','dispatch','supervisor','awaiting_parts','scheduled','done') OR length(_note)>2000 THEN RAISE EXCEPTION 'Invalid follow-up action'; END IF;
SELECT * INTO s FROM public.job_sheets WHERE id=_sheet AND company_id=c FOR UPDATE; IF NOT FOUND OR coalesce(trim(s.pending_works_future_jobs),'')='' THEN RAISE EXCEPTION 'Pending work not found'; END IF;
SELECT action INTO a FROM public.pending_work_actions WHERE sheet_id=_sheet; a=coalesce(a,s.pending_status); IF a<>_expected THEN RAISE EXCEPTION 'This item changed. Refresh before acting.'; END IF;
IF _assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_assignee AND company_id=c AND public.member_is_active(user_id) AND (_action<>'supervisor' OR role IN ('supervisor','admin','superuser'))) THEN RAISE EXCEPTION 'Choose an active company team member'; END IF;
IF _action='supervisor' AND _assignee IS NULL THEN RAISE EXCEPTION 'Choose a supervisor'; END IF;
j=s.pending_job_id;
IF _action IN ('dispatch','scheduled') THEN IF j IS NULL THEN INSERT INTO public.jobs(company_id,client_id,site_id,asset_id,assigned_technician_id,scheduled_date,problem_summary,priority) VALUES(c,s.client_id,s.site_id,s.asset_id,_assignee,_date,left('Follow-up from #'||s.jobsheet_number||': '||s.pending_works_future_jobs,500),'normal') RETURNING id INTO j; END IF; END IF;
INSERT INTO public.pending_work_actions(sheet_id,company_id,action,assigned_to,note,updated_by) VALUES(_sheet,c,_action,_assignee,_note,auth.uid()) ON CONFLICT(sheet_id) DO UPDATE SET action=excluded.action,assigned_to=excluded.assigned_to,note=excluded.note,updated_by=auth.uid(),updated_at=now();
UPDATE public.job_sheets SET pending_status=_action,pending_job_id=j WHERE id=_sheet;
IF _action='supervisor' THEN INSERT INTO public.internal_messages(company_id,sender_id,receiver_id,job_sheet_id,message_text) VALUES(c,auth.uid(),_assignee,_sheet,'Pending work needs supervisor review: '||left(s.pending_works_future_jobs,1000)||' '||_note); END IF; RETURN j; END $$;
REVOKE ALL ON FUNCTION public.route_pending_work(uuid,text,text,uuid,date,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.route_pending_work(uuid,text,text,uuid,date,text) TO authenticated;
CREATE TABLE public.leave_blackouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id),start_date date NOT NULL,end_date date NOT NULL,roles public.app_role[] NOT NULL DEFAULT ARRAY['technician']::public.app_role[],reason text NOT NULL,created_by uuid DEFAULT auth.uid(),created_at timestamptz DEFAULT now(),CHECK(end_date>=start_date),CHECK(length(reason) BETWEEN 1 AND 1000));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.leave_blackouts TO authenticated; GRANT ALL ON public.leave_blackouts TO service_role;
ALTER TABLE public.leave_blackouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY blackout_read ON public.leave_blackouts FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.member_is_active(auth.uid()));
CREATE POLICY blackout_office ON public.leave_blackouts FOR ALL TO authenticated USING(company_id=public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'))) WITH CHECK(company_id=public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) AND public.company_module_access(company_id,'core'));
ALTER TABLE public.leave_requests ADD COLUMN exception_reason text, ADD COLUMN work_handling_note text, ADD COLUMN consulted_supervisor_id uuid, ADD COLUMN supervisor_response text;
CREATE OR REPLACE FUNCTION public.guard_leave_operational_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE blackout boolean; BEGIN
SELECT EXISTS(SELECT 1 FROM public.leave_blackouts b JOIN public.user_roles r ON r.user_id=NEW.user_id AND r.company_id=b.company_id WHERE b.company_id=NEW.company_id AND r.role=ANY(b.roles) AND b.start_date<=NEW.end_date AND b.end_date>=NEW.start_date) INTO blackout;
IF TG_OP='INSERT' AND NEW.leave_type='Annual' AND blackout AND coalesce(trim(NEW.exception_reason),'')='' THEN RAISE EXCEPTION 'Annual leave overlaps a restricted period. Add an exception reason.'; END IF;
IF TG_OP='UPDATE' THEN
IF NEW.status='approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
IF NEW.leave_type='Annual' AND blackout AND NOT(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) THEN RAISE EXCEPTION 'An Office Admin must approve blackout exceptions'; END IF;
IF (EXISTS(SELECT 1 FROM public.jobs WHERE company_id=NEW.company_id AND scheduled_date BETWEEN NEW.start_date AND NEW.end_date AND (assigned_technician_id=NEW.user_id OR secondary_technician_id=NEW.user_id)) OR EXISTS(SELECT 1 FROM generate_series(NEW.start_date::timestamp,NEW.end_date::timestamp,interval '1 day') d WHERE public.is_on_standby(NEW.user_id,d::date))) AND coalesce(trim(NEW.work_handling_note),'')='' THEN RAISE EXCEPTION 'Record how scheduled jobs and on-call duties will be handled'; END IF;
END IF;
IF (NEW.exception_reason IS DISTINCT FROM OLD.exception_reason OR NEW.work_handling_note IS DISTINCT FROM OLD.work_handling_note OR NEW.consulted_supervisor_id IS DISTINCT FROM OLD.consulted_supervisor_id) AND NOT public.is_company_manager() THEN RAISE EXCEPTION 'Manager access required'; END IF;
IF NEW.supervisor_response IS DISTINCT FROM OLD.supervisor_response AND auth.uid() IS DISTINCT FROM OLD.consulted_supervisor_id THEN RAISE EXCEPTION 'Only the consulted supervisor can respond'; END IF;
END IF;
IF NEW.consulted_supervisor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE company_id=NEW.company_id AND user_id=NEW.consulted_supervisor_id AND role IN ('supervisor','admin','superuser') AND public.member_is_active(user_id)) THEN RAISE EXCEPTION 'Choose an active company supervisor'; END IF; RETURN NEW; END $$;
CREATE TRIGGER leave_operational_review BEFORE INSERT OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.guard_leave_operational_review();
ALTER TABLE public.standby_swaps ADD COLUMN end_date date, ADD COLUMN manager_approved boolean NOT NULL DEFAULT false, ADD COLUMN approved_by uuid, ADD COLUMN approved_at timestamptz;
UPDATE public.standby_swaps SET end_date=swap_date,manager_approved=(status='accepted');
CREATE OR REPLACE FUNCTION public.guard_standby_swap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d date; BEGIN
IF NOT public.company_module_access(NEW.company_id,'standby') THEN RAISE EXCEPTION 'On-call module unavailable'; END IF;
IF NEW.status NOT IN ('pending','accepted','declined','cancelled') THEN RAISE EXCEPTION 'Invalid swap status'; END IF;
IF TG_OP='INSERT' THEN
NEW.end_date=coalesce(NEW.end_date,NEW.swap_date); IF NEW.end_date<NEW.swap_date OR NEW.end_date-NEW.swap_date>30 OR NEW.swap_date<current_date THEN RAISE EXCEPTION 'Choose an upcoming range of up to 31 days'; END IF;
IF NEW.manager_approved OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Approval cannot be set on creation'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE company_id=NEW.company_id AND user_id=NEW.target_id AND role IN ('technician','supervisor') AND public.member_is_active(user_id)) THEN RAISE EXCEPTION 'Choose an active company technician'; END IF;
FOR d IN SELECT generate_series(NEW.swap_date,NEW.end_date,interval '1 day')::date LOOP
IF NOT public.is_on_standby(NEW.requester_id,d) OR public.is_on_standby(NEW.target_id,d) THEN RAISE EXCEPTION 'Select only your on-call days; colleague must be free throughout'; END IF; END LOOP;
IF EXISTS(SELECT 1 FROM public.standby_swaps WHERE company_id=NEW.company_id AND status IN ('pending','accepted') AND requester_id=NEW.requester_id AND swap_date<=NEW.end_date AND coalesce(end_date,swap_date)>=NEW.swap_date) THEN RAISE EXCEPTION 'A swap already covers these dates'; END IF;
ELSE
IF NEW.swap_date<>OLD.swap_date OR NEW.end_date IS DISTINCT FROM OLD.end_date OR NEW.company_id<>OLD.company_id OR NEW.requester_id<>OLD.requester_id OR NEW.target_id<>OLD.target_id THEN RAISE EXCEPTION 'Swap details cannot change'; END IF;
IF NEW.status<>OLD.status THEN
IF OLD.manager_approved THEN RAISE EXCEPTION 'Approved swap cannot be changed'; END IF;
IF NEW.status IN ('accepted','declined') AND (OLD.status<>'pending' OR auth.uid()<>OLD.target_id) THEN RAISE EXCEPTION 'Only the colleague asked can answer a pending request'; END IF;
IF NEW.status='cancelled' AND NOT(auth.uid()=OLD.requester_id OR public.is_company_manager()) THEN RAISE EXCEPTION 'Only requester or manager can cancel'; END IF; NEW.responded_at=now(); END IF;
IF NEW.manager_approved IS DISTINCT FROM OLD.manager_approved THEN
IF NOT public.is_company_manager() OR OLD.status<>'accepted' OR NOT NEW.manager_approved OR auth.uid() IN (OLD.requester_id,OLD.target_id) THEN RAISE EXCEPTION 'An independent manager must approve an accepted swap'; END IF;
FOR d IN SELECT generate_series(NEW.swap_date,NEW.end_date,interval '1 day')::date LOOP IF NOT public.is_on_standby(NEW.requester_id,d) OR public.is_on_standby(NEW.target_id,d) THEN RAISE EXCEPTION 'Roster changed; cancel and request again'; END IF; END LOOP;
NEW.approved_by=auth.uid(); NEW.approved_at=now();
ELSIF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN RAISE EXCEPTION 'Approval audit cannot change'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER standby_swaps_insert_guard BEFORE INSERT ON public.standby_swaps FOR EACH ROW EXECUTE FUNCTION public.guard_standby_swap();
CREATE OR REPLACE FUNCTION public.is_on_standby(_user uuid,_date date) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE s record;n int;per int;blk int;first int;ids uuid[]='{}';k int;sw record; BEGIN
SELECT cs.* INTO s FROM public.company_settings cs JOIN public.users u ON u.company_id=cs.company_id WHERE u.id=_user; IF NOT FOUND THEN RETURN false; END IF;
n=coalesce(array_length(s.standby_order,1),0);IF n=0 THEN RETURN false; END IF;per=greatest(1,least(s.standby_per_shift,n));blk=floor((_date-s.standby_start)::numeric/greatest(1,s.standby_rotation_days));first=(((blk*per)%n)+n)%n;
FOR k IN 0..per-1 LOOP ids=ids||s.standby_order[((first+k)%n)+1];END LOOP;
FOR sw IN SELECT requester_id,target_id FROM public.standby_swaps WHERE company_id=s.company_id AND _date BETWEEN swap_date AND coalesce(end_date,swap_date) AND status='accepted' AND manager_approved ORDER BY created_at LOOP IF sw.requester_id=ANY(ids) AND NOT sw.target_id=ANY(ids) THEN ids=array_replace(ids,sw.requester_id,sw.target_id);END IF;END LOOP;RETURN _user=ANY(ids);END $$;
CREATE TABLE public.equipment_report_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id),asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,token_hash text NOT NULL UNIQUE,revoked_at timestamptz,last_report_at timestamptz,created_at timestamptz DEFAULT now());
GRANT SELECT,UPDATE ON public.equipment_report_links TO authenticated; GRANT ALL ON public.equipment_report_links TO service_role;
ALTER TABLE public.equipment_report_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_links_manager ON public.equipment_report_links FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.is_company_manager()) WITH CHECK(company_id=public.current_company_id() AND public.is_company_manager());
CREATE TABLE public.equipment_problem_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES public.companies(id),asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,first_name text NOT NULL,last_name text NOT NULL,position text NOT NULL,problem text NOT NULL,status text NOT NULL DEFAULT 'open',created_at timestamptz DEFAULT now());
GRANT SELECT,UPDATE ON public.equipment_problem_reports TO authenticated; GRANT ALL ON public.equipment_problem_reports TO service_role;
ALTER TABLE public.equipment_problem_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY problem_reports_manager ON public.equipment_problem_reports FOR ALL TO authenticated USING(company_id=public.current_company_id() AND public.is_company_manager()) WITH CHECK(company_id=public.current_company_id() AND public.is_company_manager());
CREATE OR REPLACE FUNCTION public.create_equipment_report_link(_asset uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE t text=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');c uuid=public.current_company_id(); BEGIN IF NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() OR NOT public.company_module_access(c,'core') OR NOT EXISTS(SELECT 1 FROM public.assets WHERE id=_asset AND company_id=c) THEN RAISE EXCEPTION 'Manager access required';END IF;INSERT INTO public.equipment_report_links(company_id,asset_id,token_hash) VALUES(c,_asset,encode(sha256(t::bytea),'hex'));RETURN t;END $$;
REVOKE ALL ON FUNCTION public.create_equipment_report_link(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.create_equipment_report_link(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_equipment_problem(_token text,_first text,_last text,_position text,_problem text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE l public.equipment_report_links; BEGIN
IF _token !~ '^[a-f0-9]{64}$' OR length(trim(_first)) NOT BETWEEN 1 AND 100 OR length(trim(_last)) NOT BETWEEN 1 AND 100 OR length(trim(_position)) NOT BETWEEN 1 AND 100 OR length(trim(_problem)) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Complete all report fields';END IF;
SELECT * INTO l FROM public.equipment_report_links WHERE token_hash=encode(sha256(_token::bytea),'hex') AND revoked_at IS NULL FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'This reporting link is unavailable';END IF;
IF NOT public.company_module_access(l.company_id,'core') OR l.last_report_at>now()-interval '30 seconds' THEN RAISE EXCEPTION 'Reporting is temporarily unavailable. Please try later.';END IF;
INSERT INTO public.equipment_problem_reports(company_id,asset_id,first_name,last_name,position,problem) VALUES(l.company_id,l.asset_id,trim(_first),trim(_last),trim(_position),trim(_problem));UPDATE public.equipment_report_links SET last_report_at=now() WHERE id=l.id;END $$;
REVOKE ALL ON FUNCTION public.submit_equipment_problem(text,text,text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.submit_equipment_problem(text,text,text,text,text) TO anon,authenticated;
CREATE TABLE public.team_role_changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,member_id uuid NOT NULL,old_role public.app_role NOT NULL,new_role public.app_role NOT NULL,changed_by uuid,changed_at timestamptz DEFAULT now());
GRANT SELECT ON public.team_role_changes TO authenticated;GRANT ALL ON public.team_role_changes TO service_role;ALTER TABLE public.team_role_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_audit_office ON public.team_role_changes FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')));
CREATE OR REPLACE FUNCTION public.audit_team_role_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF OLD.role IS DISTINCT FROM NEW.role THEN INSERT INTO public.team_role_changes(company_id,member_id,old_role,new_role,changed_by) VALUES(NEW.company_id,NEW.user_id,OLD.role,NEW.role,auth.uid());END IF;RETURN NEW;END $$;
CREATE TRIGGER team_role_change_audit AFTER UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_team_role_change();