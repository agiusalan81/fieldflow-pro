-- Transactional tests use existing active role fixtures; no stored signatures survive.
BEGIN;
DO $$
DECLARE actor uuid; tenant uuid; before_signature text; other_actor uuid;
BEGIN
 IF has_function_privilege('anon','public.save_my_staff_signature(text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous signature writes allowed'; END IF;
 IF NOT has_function_privilege('anon','public.fieldbridge_public_legal()','EXECUTE') THEN RAISE EXCEPTION 'Public legal projection inaccessible'; END IF;
 SELECT user_id,company_id INTO actor,tenant FROM public.user_roles WHERE role='technician' AND registration_status='active' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Active technician fixture required'; END IF;
 SELECT signature_on_file INTO before_signature FROM public.users WHERE id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM public.save_my_staff_signature('data:image/png;base64,iVBORw0KGgo=');
 IF (SELECT signature_on_file FROM public.users WHERE id=actor) IS DISTINCT FROM 'data:image/png;base64,iVBORw0KGgo=' THEN RAISE EXCEPTION 'Own signature did not persist'; END IF;
 BEGIN
   PERFORM public.save_my_staff_signature('data:image/svg+xml;base64,abcd');
   RAISE EXCEPTION 'Invalid payload accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid payload accepted' THEN RAISE; END IF; END;
 BEGIN
   PERFORM public.save_my_staff_signature('data:image/png;base64,'||repeat('a',200000));
   RAISE EXCEPTION 'Oversized payload accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Oversized payload accepted' THEN RAISE; END IF; END;
 RESET ROLE;
 -- Ensure office and company superuser cannot use the self-service path.
 FOR actor IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','superuser') AND registration_status='active' LOOP
   PERFORM set_config('request.jwt.claim.sub',actor::text,true);
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
   SET LOCAL ROLE authenticated;
   BEGIN
     PERFORM public.save_my_staff_signature('data:image/png;base64,iVBORw0KGgo=');
     RAISE EXCEPTION 'Office role accepted';
   EXCEPTION WHEN raise_exception THEN IF SQLERRM='Office role accepted' THEN RAISE; END IF; END;
   RESET ROLE;
 END LOOP;
END $$;
ROLLBACK;