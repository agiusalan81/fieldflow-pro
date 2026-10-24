BEGIN;
DO $$
DECLARE actor uuid; tenant uuid; client uuid; asset uuid; agreement uuid; plan uuid; n integer; original_count integer;
BEGIN
 SELECT user_id,company_id INTO actor,tenant FROM public.user_roles WHERE role IN ('superuser','admin') AND registration_status='active' ORDER BY created_at LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Active office fixture required'; END IF;
 SELECT id INTO client FROM public.clients WHERE company_id=tenant LIMIT 1;
 IF client IS NULL THEN RAISE EXCEPTION 'Client fixture required'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.assets(company_id,client_id,reference_number,asset_category) VALUES(tenant,client,'PPM rollback-only verification','Elevator') RETURNING id INTO asset;
 INSERT INTO public.maintenance_agreements(company_id,client_id,start_date,end_date) VALUES(tenant,client,'2026-01-31','2026-12-31') RETURNING id INTO agreement;
 INSERT INTO public.ppm_plans(agreement_id,asset_id,first_due_date,interval_months,grace_days) VALUES(agreement,asset,'2026-01-31',1,3) RETURNING id INTO plan;
 SELECT count(*) INTO original_count FROM public.jobs WHERE ppm_plan_id=plan;
 IF original_count<>12 THEN RAISE EXCEPTION 'Expected 12 monthly visits, got %',original_count; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.jobs WHERE ppm_plan_id=plan AND ppm_due_date='2026-02-28' AND ppm_deadline='2026-03-03') THEN RAISE EXCEPTION 'Month-end anchor or grace deadline failed'; END IF;
 n=public.generate_ppm_visits(plan);
 IF n<>0 OR (SELECT count(*) FROM public.jobs WHERE ppm_plan_id=plan)<>12 THEN RAISE EXCEPTION 'Repeated generation created duplicates'; END IF;
 BEGIN
 UPDATE public.jobs SET ppm_due_date='2026-01-01' WHERE ppm_plan_id=plan;
 RAISE EXCEPTION 'Immutable occurrence identity changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Immutable occurrence identity changed' THEN RAISE; END IF; END;
 INSERT INTO public.asset_component_events(asset_id,component,event_type,event_date,warranty_until) VALUES(asset,'Controller','replaced','2026-01-31','2027-01-31');
 BEGIN
 INSERT INTO public.asset_component_events(asset_id,component,event_type,event_date,warranty_until) VALUES(asset,'Controller','replaced','2026-01-31','2026-01-01');
 RAISE EXCEPTION 'Invalid warranty accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid warranty accepted' THEN RAISE; END IF; END;
 RESET ROLE;
END $$;
ROLLBACK;
