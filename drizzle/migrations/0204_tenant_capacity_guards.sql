CREATE OR REPLACE FUNCTION public.company_seat_limit(_company uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN s.id IS NULL OR s.status NOT IN ('active','read_only') OR p.id IS NULL THEN NULL ELSE greatest(coalesce(p.included_seats,0),coalesce(s.seats,0)) END
 FROM (SELECT 1) x LEFT JOIN public.platform_subscriptions s ON s.company_id=_company AND s.product_id=public.company_product_id(_company) LEFT JOIN public.platform_catalog p ON p.id=s.plan_id AND p.product_id=s.product_id;
$$;
REVOKE ALL ON FUNCTION public.company_seat_limit(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.company_seat_limit(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.company_seat_usage(_company uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE cap integer; used integer; reserved integer;
BEGIN
 IF NOT (public.is_platform_owner() OR (_company=public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()))) THEN RAISE EXCEPTION 'Manager access required'; END IF;
 cap:=public.company_seat_limit(_company);
 SELECT count(*) INTO used FROM public.user_roles WHERE company_id=_company AND registration_status='active';
 SELECT count(*) INTO reserved FROM public.company_invites WHERE company_id=_company AND used_at IS NULL AND expires_at>now();
 RETURN jsonb_build_object('active_members',used,'pending_invites',reserved,'seat_limit',cap,'available_seats',CASE WHEN cap IS NULL THEN NULL ELSE greatest(0,cap-used-reserved) END);
END $$;
REVOKE ALL ON FUNCTION public.company_seat_usage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.company_seat_usage(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_team_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cap integer; used integer; reserved integer; exclude_invite uuid;
BEGIN
 IF TG_TABLE_NAME='company_invites' THEN
  IF NEW.used_at IS NOT NULL OR NEW.expires_at<=now() THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
   IF NEW.company_id=OLD.company_id AND OLD.used_at IS NULL AND OLD.expires_at>now() THEN RETURN NEW; END IF;
   exclude_invite:=OLD.id;
  END IF;
 ELSE
  IF NEW.registration_status<>'active' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN IF OLD.registration_status='active' AND NEW.company_id=OLD.company_id THEN RETURN NEW; END IF; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('team-capacity:'||NEW.company_id::text,0));
 cap:=public.company_seat_limit(NEW.company_id);
 IF cap IS NULL THEN RETURN NEW; END IF;
 SELECT count(*) INTO used FROM public.user_roles WHERE company_id=NEW.company_id AND registration_status='active';
 -- Membership insertion exchanges an invitation reservation for a live seat.
 -- Existing acceptance functions consume the invitation later in the same transaction.
 IF TG_TABLE_NAME='company_invites' OR TG_OP='UPDATE' THEN
  SELECT count(*) INTO reserved FROM public.company_invites WHERE company_id=NEW.company_id AND used_at IS NULL AND expires_at>now() AND (exclude_invite IS NULL OR id<>exclude_invite);
 ELSE reserved:=0; END IF;
 IF used+reserved>=cap THEN RAISE EXCEPTION 'Team seat limit reached (% active, % reserved, % licensed). Revoke an unused invitation or ask your Company Superuser to increase seats in Billing & Plan.',used,reserved,cap; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER team_capacity_invite BEFORE INSERT OR UPDATE ON public.company_invites FOR EACH ROW EXECUTE FUNCTION public.guard_team_capacity();
CREATE TRIGGER team_capacity_member BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_team_capacity();
CREATE OR REPLACE FUNCTION public.company_storage_usage(_company uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE used bigint; allowance integer; s record;
BEGIN
 IF NOT (public.is_platform_owner() OR (_company=public.current_company_id() AND (public.has_role(auth.uid(),'superuser') OR public.has_role(auth.uid(),'admin')))) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT coalesce(sum((o.metadata->>'size')::bigint),0) INTO used FROM storage.objects o WHERE split_part(o.name,'/',1)=_company::text;
 SELECT * INTO s FROM public.platform_subscriptions WHERE company_id=_company AND product_id=public.company_product_id(_company);
 allowance:=coalesce((SELECT sum(c.storage_gb) FROM public.platform_catalog c WHERE c.product_id=s.product_id AND (c.id=s.plan_id OR c.id=ANY(coalesce(s.pack_ids,'{}')))),0);
 IF allowance=0 OR s.plan_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.platform_catalog WHERE id=s.plan_id AND product_id=s.product_id AND storage_gb>0) THEN allowance:=allowance+10; END IF;
 RETURN jsonb_build_object('used_bytes',used,'allowance_gb',allowance);
END $$;