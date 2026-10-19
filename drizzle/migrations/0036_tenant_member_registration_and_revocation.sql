ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'active', ADD COLUMN IF NOT EXISTS terminated_at timestamptz, ADD COLUMN IF NOT EXISTS terminated_by uuid, ADD COLUMN IF NOT EXISTS termination_reason text;
CREATE TABLE public.member_access_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), user_id uuid NOT NULL, actor_id uuid NOT NULL, action text NOT NULL, reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.member_access_events TO authenticated;
GRANT ALL ON public.member_access_events TO service_role;
ALTER TABLE public.member_access_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY office_read ON public.member_access_events FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND public.has_company_role('admin'));
CREATE OR REPLACE FUNCTION public.member_is_active(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.users u ON u.id=r.user_id AND u.company_id=r.company_id WHERE r.user_id=_user AND r.registration_status='active') $$;
REVOKE ALL ON FUNCTION public.member_is_active(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.member_is_active(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT r.company_id FROM public.user_roles r JOIN public.users u ON u.id=r.user_id AND u.company_id=r.company_id WHERE r.user_id=auth.uid() AND r.registration_status='active' $$;
CREATE OR REPLACE FUNCTION public.my_role() RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT role FROM public.user_roles WHERE user_id=auth.uid() AND registration_status='active' $$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role AND registration_status='active') $$;
CREATE OR REPLACE FUNCTION public.has_company_role(_role public.user_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND registration_status='active' AND (role::text=_role::text OR (_role='admin' AND role='superuser'))) $$;
CREATE OR REPLACE FUNCTION public.is_company_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND registration_status='active' AND role IN ('superuser','admin','supervisor')) $$;
DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'platform_%' LOOP EXECUTE format('CREATE POLICY active_member_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.member_is_active(auth.uid())) WITH CHECK (public.member_is_active(auth.uid()))',t.tablename); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.guard_member_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.registration_status NOT IN ('active','terminated') THEN RAISE EXCEPTION 'Invalid registration status'; END IF;
 IF auth.uid() IS NOT NULL AND TG_OP='UPDATE' THEN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN RAISE EXCEPTION 'Membership identity cannot be changed'; END IF;
  IF NEW.registration_status IS DISTINCT FROM OLD.registration_status OR NEW.terminated_at IS DISTINCT FROM OLD.terminated_at OR NEW.terminated_by IS DISTINCT FROM OLD.terminated_by OR NEW.termination_reason IS DISTINCT FROM OLD.termination_reason THEN
   IF NOT public.has_company_role('admin') OR OLD.company_id IS DISTINCT FROM public.current_company_id() OR OLD.user_id=auth.uid() OR OLD.platform_owner OR (OLD.role='superuser' AND public.my_role()<>'superuser') THEN RAISE EXCEPTION 'You cannot change this member access'; END IF;
   IF NEW.registration_status='terminated' THEN NEW.terminated_at:=now(); NEW.terminated_by:=auth.uid(); ELSE NEW.terminated_at:=NULL; NEW.terminated_by:=NULL; END IF;
   INSERT INTO public.member_access_events(company_id,user_id,actor_id,action,reason) VALUES(OLD.company_id,OLD.user_id,auth.uid(),NEW.registration_status,coalesce(NEW.termination_reason,''));
  END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_member_registration BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_member_registration();
CREATE OR REPLACE FUNCTION public.set_member_access(_user uuid,_active boolean,_reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target public.user_roles; BEGIN
 IF NOT public.has_company_role('admin') THEN RAISE EXCEPTION 'Only office admins can manage registrations'; END IF;
 SELECT * INTO target FROM public.user_roles WHERE user_id=_user AND company_id=public.current_company_id() FOR UPDATE;
 IF NOT FOUND OR _user=auth.uid() OR target.platform_owner OR (target.role='superuser' AND public.my_role()<>'superuser') THEN RAISE EXCEPTION 'You cannot change this member access'; END IF;
 IF NOT _active AND nullif(trim(_reason),'') IS NULL THEN RAISE EXCEPTION 'Enter a reason for revoking access'; END IF;
 UPDATE public.user_roles SET registration_status=CASE WHEN _active THEN 'active' ELSE 'terminated' END, termination_reason=left(trim(_reason),500) WHERE user_id=_user;
 END $$;
REVOKE ALL ON FUNCTION public.set_member_access(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_member_access(uuid,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.my_registration_status() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT registration_status FROM public.user_roles WHERE user_id=auth.uid() $$;
REVOKE ALL ON FUNCTION public.my_registration_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_registration_status() TO authenticated;
CREATE OR REPLACE FUNCTION public.registered_members() RETURNS TABLE(id uuid,full_name text,email text,employee_id text,role public.app_role,platform_owner boolean,created_at timestamptz,registration_status text,terminated_at timestamptz,termination_reason text,providers text[]) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.is_company_manager() THEN RAISE EXCEPTION 'Only managers can view registered members'; END IF;
 RETURN QUERY SELECT u.id,u.full_name,u.email,u.employee_id,r.role,r.platform_owner,u.created_at,r.registration_status,r.terminated_at,CASE WHEN public.has_company_role('admin') THEN r.termination_reason ELSE NULL END,ARRAY(SELECT DISTINCT i.provider::text FROM auth.identities i WHERE i.user_id=u.id) FROM public.users u JOIN public.user_roles r ON r.user_id=u.id AND r.company_id=u.company_id WHERE u.company_id=public.current_company_id() ORDER BY u.full_name;
 END $$;
REVOKE ALL ON FUNCTION public.registered_members() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registered_members() TO authenticated;
CREATE OR REPLACE FUNCTION public.accept_company_invite_named(_token text,_first_name text,_surname text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid:=auth.uid(); inv public.company_invites; account_email text; verified_at timestamptz; person_name text; BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in before accepting your invitation'; END IF;
 IF nullif(trim(_first_name),'') IS NULL OR nullif(trim(_surname),'') IS NULL THEN RAISE EXCEPTION 'Enter your first name and surname'; END IF;
 person_name:=left(trim(_first_name)||' '||trim(_surname),200);
 IF _token IS NULL OR _token !~ '^[a-f0-9]{36}$' THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT email,email_confirmed_at INTO account_email,verified_at FROM auth.users WHERE id=uid;
 IF verified_at IS NULL THEN RAISE EXCEPTION 'Confirm your email before joining'; END IF;
 SELECT * INTO inv FROM public.company_invites WHERE token=_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND registration_status<>'active') THEN RAISE EXCEPTION 'Your company access has been revoked. Contact your office'; END IF;
 IF inv.used_by=uid AND inv.used_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND company_id=inv.company_id) THEN RETURN inv.company_id; END IF;
 IF inv.used_at IS NOT NULL OR inv.expires_at<=now() THEN RAISE EXCEPTION 'Invitation expired or already used'; END IF;
 IF nullif(trim(inv.email),'') IS NOT NULL AND lower(trim(inv.email))<>lower(trim(account_email)) THEN RAISE EXCEPTION 'Use the email account named on this invitation'; END IF;
 IF EXISTS(SELECT 1 FROM public.users WHERE id=uid) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid) THEN RAISE EXCEPTION 'This account already belongs to a company. Use a different account'; END IF;
 INSERT INTO public.users(id,company_id,full_name,email,role) VALUES(uid,inv.company_id,person_name,account_email,(CASE WHEN inv.role IN ('superuser','admin') THEN 'admin' ELSE inv.role::text END)::public.user_role);
 INSERT INTO public.user_roles(user_id,company_id,role) VALUES(uid,inv.company_id,inv.role);
 UPDATE public.company_invites SET used_at=now(),used_by=uid WHERE id=inv.id;
 RETURN inv.company_id; END $$;
REVOKE ALL ON FUNCTION public.accept_company_invite_named(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_company_invite_named(text,text,text) TO authenticated;