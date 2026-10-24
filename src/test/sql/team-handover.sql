-- All changes are rolled back; no employee is actually terminated.
BEGIN;
DO $$
DECLARE actor uuid; tenant uuid; person uuid; replacement uuid; client uuid; job uuid; old_sheet_count int; summary jsonb; cycle int;
BEGIN
 SELECT user_id,company_id INTO actor,tenant FROM public.user_roles WHERE role='superuser' AND registration_status='active' AND NOT platform_owner AND public.company_module_access(company_id,'core') LIMIT 1;
 SELECT user_id INTO person FROM public.user_roles WHERE company_id=tenant AND role='technician' AND registration_status='active' AND NOT platform_owner ORDER BY user_id LIMIT 1;
 SELECT user_id INTO replacement FROM public.user_roles WHERE company_id=tenant AND role IN('technician','supervisor') AND registration_status='active' AND user_id<>person ORDER BY user_id LIMIT 1;
 SELECT id INTO client FROM public.clients WHERE company_id=tenant LIMIT 1;
 IF actor IS NULL OR person IS NULL OR replacement IS NULL OR client IS NULL THEN RAISE EXCEPTION 'Active office/field/client fixtures required'; END IF;
 SELECT count(*) INTO old_sheet_count FROM public.job_sheets WHERE assigned_technician_id=person;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 INSERT INTO public.jobs(company_id,client_id,assigned_technician_id,scheduled_date,problem_summary) VALUES(tenant,client,person,current_date,'Rollback-only handover verification') RETURNING id INTO job;
 summary=public.member_handover_preview(person);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(summary->'jobs') j WHERE j->>'id'=job::text) THEN RAISE EXCEPTION 'Preview omitted upcoming lead assignment'; END IF;
 BEGIN
   PERFORM public.terminate_member_handover(person,'Rollback verification','[]');
   RAISE EXCEPTION 'Unreviewed assignment accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unreviewed assignment accepted' THEN RAISE; END IF; END;
 IF NOT public.member_is_active(person) THEN RAISE EXCEPTION 'Failed review changed access'; END IF;
 IF public.company_module_access(tenant,'standby') THEN
  FOREACH cycle IN ARRAY ARRAY[2,4] LOOP
   PERFORM public.save_standby_track('technician',current_date,cycle,1,ARRAY[person,replacement]::uuid[]);
   IF (SELECT standby_rotation_days FROM public.company_settings WHERE company_id=tenant)<>cycle THEN RAISE EXCEPTION 'Custom rotation did not save'; END IF;
  END LOOP;
 END IF;
 -- Office dispatch requires no additional paid Smart Dispatch entitlement.
 SELECT jsonb_agg(jsonb_build_object('jobId',j->>'id','replacement',NULL)) INTO summary FROM jsonb_array_elements(public.member_handover_preview(person)->'jobs') j;
 PERFORM public.terminate_member_handover(person,'Rollback verification',summary);
 IF public.member_is_active(person) THEN RAISE EXCEPTION 'Termination did not block access'; END IF;
 IF (SELECT assigned_technician_id FROM public.jobs WHERE id=job) IS NOT NULL THEN RAISE EXCEPTION 'Vacancy not returned to office dispatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.shifts WHERE user_id=person AND ended_at IS NULL) THEN RAISE EXCEPTION 'Open shifts remain'; END IF;
 IF EXISTS(SELECT 1 FROM public.company_settings WHERE company_id=tenant AND person=ANY(standby_order)) THEN RAISE EXCEPTION 'Terminated person remains on rota'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.member_access_events WHERE user_id=person AND handover IS NOT NULL) THEN RAISE EXCEPTION 'Missing handover audit'; END IF;
 IF (SELECT count(*) FROM public.job_sheets WHERE assigned_technician_id=person)<>old_sheet_count THEN RAISE EXCEPTION 'Historical sheets changed'; END IF;
 IF public.is_on_standby(person,current_date) THEN RAISE EXCEPTION 'Terminated member counted on standby'; END IF;
 RAISE NOTICE 'Atomic review, 2/4-day cycles, access revocation, dispatch vacancy, rota removal, shift closure and historical evidence passed';
END $$;
ROLLBACK;