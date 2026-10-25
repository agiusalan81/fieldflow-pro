ALTER TABLE public.standby_swaps ADD COLUMN acceptance_applied boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.guard_standby_swap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d date; apply_swap boolean:=false; BEGIN
IF NEW.company_id IS DISTINCT FROM public.current_company_id() OR NOT public.member_is_active(auth.uid()) OR NOT public.company_module_access(NEW.company_id,'standby') THEN RAISE EXCEPTION 'On-call module unavailable';END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text||':standby',0));
IF NEW.status NOT IN('pending','accepted','declined','cancelled') THEN RAISE EXCEPTION 'Invalid swap status';END IF;
IF TG_OP='INSERT' THEN
NEW.end_date=coalesce(NEW.end_date,NEW.swap_date);
IF NEW.requester_id IS DISTINCT FROM auth.uid() OR NEW.status<>'pending' OR NEW.end_date<NEW.swap_date OR NEW.end_date-NEW.swap_date>30 OR NEW.swap_date<current_date THEN RAISE EXCEPTION 'Choose your upcoming range of up to 31 days';END IF;
IF NEW.manager_approved OR NEW.acceptance_applied OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Swap audit cannot be set on creation';END IF;
IF NOT public.company_module_access(NEW.company_id,'skills_dispatch') OR NOT public.same_standby_primary_skill(NEW.requester_id,NEW.target_id,NEW.company_id) THEN RAISE EXCEPTION 'Choose a colleague with the same primary skill';END IF;
ELSE
IF (NEW.track,NEW.swap_date,NEW.end_date,NEW.company_id,NEW.requester_id,NEW.target_id,NEW.note) IS DISTINCT FROM(OLD.track,OLD.swap_date,OLD.end_date,OLD.company_id,OLD.requester_id,OLD.target_id,OLD.note) THEN RAISE EXCEPTION 'Swap details cannot change';END IF;
IF (NEW.acceptance_applied,NEW.approved_by,NEW.approved_at) IS DISTINCT FROM(OLD.acceptance_applied,OLD.approved_by,OLD.approved_at) THEN RAISE EXCEPTION 'Swap audit cannot change';END IF;
IF NEW.status<>OLD.status THEN
IF OLD.manager_approved THEN RAISE EXCEPTION 'Applied swap cannot change';END IF;
IF NEW.status IN('accepted','declined') AND (OLD.status<>'pending' OR auth.uid()<>OLD.target_id) THEN RAISE EXCEPTION 'Only the colleague asked can answer a pending request';END IF;
IF NEW.status='cancelled' AND NOT(auth.uid()=OLD.requester_id OR public.is_company_manager()) THEN RAISE EXCEPTION 'Only requester or manager can cancel';END IF;
NEW.responded_at=now();
IF NEW.status='accepted' THEN
IF NOT public.company_module_access(NEW.company_id,'skills_dispatch') OR NOT public.same_standby_primary_skill(NEW.requester_id,NEW.target_id,NEW.company_id) THEN RAISE EXCEPTION 'Choose a colleague with the same primary skill';END IF;
apply_swap=true;
END IF;
END IF;
IF NEW.manager_approved IS DISTINCT FROM OLD.manager_approved THEN
IF NOT public.is_company_manager() OR OLD.status<>'accepted' OR NEW.status<>'accepted' OR NOT NEW.manager_approved OR auth.uid() IN(OLD.requester_id,OLD.target_id) THEN RAISE EXCEPTION 'An independent manager must review this existing swap';END IF;
apply_swap=true;
END IF;
END IF;
IF TG_OP='INSERT' OR apply_swap THEN
IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE company_id=NEW.company_id AND user_id=NEW.requester_id AND role::text=NEW.track AND public.member_is_active(user_id)) OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE company_id=NEW.company_id AND user_id=NEW.target_id AND role::text=NEW.track AND public.member_is_active(user_id)) THEN RAISE EXCEPTION 'Choose an active colleague from the same rota role';END IF;
IF NEW.swap_date<current_date THEN RAISE EXCEPTION 'Swap range has already started';END IF;
FOR d IN SELECT generate_series(NEW.swap_date,NEW.end_date,interval '1 day')::date LOOP
IF NOT NEW.requester_id=ANY(public.standby_track_ids(NEW.company_id,d,NEW.track)) OR NEW.target_id=ANY(public.standby_track_ids(NEW.company_id,d,NEW.track)) OR EXISTS(SELECT 1 FROM public.leave_requests WHERE company_id=NEW.company_id AND user_id=NEW.target_id AND status='approved' AND d BETWEEN start_date AND end_date) THEN RAISE EXCEPTION 'Roster or availability changed; choose an available colleague';END IF;
END LOOP;
IF EXISTS(SELECT 1 FROM public.standby_swaps WHERE id<>NEW.id AND company_id=NEW.company_id AND track=NEW.track AND status IN('pending','accepted') AND (requester_id IN(NEW.requester_id,NEW.target_id) OR target_id IN(NEW.requester_id,NEW.target_id)) AND swap_date<=NEW.end_date AND coalesce(end_date,swap_date)>=NEW.swap_date) THEN RAISE EXCEPTION 'A swap already covers these dates';END IF;
IF apply_swap THEN NEW.manager_approved=true;NEW.approved_at=now();IF OLD.status='pending' THEN NEW.acceptance_applied=true;NEW.approved_by=NULL;ELSE NEW.approved_by=auth.uid();END IF;END IF;
END IF;
RETURN NEW;END $$;