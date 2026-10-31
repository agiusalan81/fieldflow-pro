-- Rollback-only capacity enforcement regression. Existing staff and catalogue prices are untouched.
BEGIN;
DO $$
DECLARE tenant uuid; actor uuid; sub uuid; plan uuid; cap integer; inv uuid; usage jsonb;
BEGIN
 SELECT r.company_id,r.user_id,s.id,s.plan_id INTO tenant,actor,sub,plan FROM public.user_roles r JOIN public.platform_subscriptions s ON s.company_id=r.company_id WHERE r.role='superuser' AND r.registration_status='active' AND s.plan_id IS NOT NULL ORDER BY r.created_at LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Company Superuser fixture required'; END IF;
 SELECT included_seats INTO cap FROM public.platform_catalog WHERE id=plan;
 UPDATE public.platform_subscriptions SET status='active',seats=cap WHERE id=sub;
 UPDATE public.platform_catalog SET included_seats=0 WHERE id=plan;
 SELECT count(*) INTO cap FROM public.user_roles WHERE company_id=tenant AND registration_status='active';
 UPDATE public.platform_subscriptions SET seats=cap+1 WHERE id=sub;
 UPDATE public.company_invites SET expires_at=now()-interval '1 minute' WHERE company_id=tenant AND used_at IS NULL;
 INSERT INTO public.company_invites(company_id,role,full_name) VALUES(tenant,'technician','Capacity rollback fixture') RETURNING id INTO inv;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 usage:=public.company_seat_usage(tenant);
 IF (usage->>'available_seats')::integer<>0 OR (usage->>'pending_invites')::integer<>1 THEN RAISE EXCEPTION 'Invitation did not reserve final seat'; END IF;
 BEGIN
  INSERT INTO public.company_invites(company_id,role,full_name) VALUES(tenant,'technician','Must reject');
  RAISE EXCEPTION 'Over-capacity invitation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Over-capacity invitation accepted' THEN RAISE; END IF; IF SQLERRM NOT LIKE 'Team seat limit reached%' THEN RAISE; END IF; END;
 DELETE FROM public.company_invites WHERE id=inv;
 IF (public.company_seat_usage(tenant)->>'available_seats')::integer<>1 THEN RAISE EXCEPTION 'Revocation did not release seat'; END IF;
 UPDATE public.platform_subscriptions SET status='trial' WHERE id=sub;
 IF public.company_seat_limit(tenant) IS NOT NULL THEN RAISE EXCEPTION 'Trial unexpectedly limited'; END IF;
END $$;
ROLLBACK;