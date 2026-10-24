CREATE OR REPLACE FUNCTION public.sync_legacy_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN UPDATE public.users SET role=(CASE WHEN NEW.role IN('superuser','admin') THEN 'admin' WHEN NEW.role='maintenance' THEN 'technician' ELSE NEW.role::text END)::public.user_role WHERE id=NEW.user_id; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.has_company_role(_role public.user_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND registration_status='active' AND (role::text=_role::text OR (_role='admin' AND role='superuser') OR (_role='technician' AND role='maintenance'))) $$;
ALTER POLICY "invites created by managers" ON public.company_invites WITH CHECK (company_id=public.current_company_id() AND (public.has_role(auth.uid(),'superuser') OR (public.has_role(auth.uid(),'admin') AND role<>'superuser') OR (public.has_role(auth.uid(),'supervisor') AND role IN('technician','supervisor','maintenance'))));
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _company_name text:=nullif(trim(NEW.raw_user_meta_data->>'company_name'),''); _token text:=nullif(trim(NEW.raw_user_meta_data->>'invite_token'),''); _full_name text:=coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'),''),split_part(NEW.email,'@',1)); _company_id uuid; _inv public.company_invites;
BEGIN IF _token IS NOT NULL THEN
 SELECT * INTO _inv FROM public.company_invites WHERE token=_token AND used_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This invite link is invalid or has expired'; END IF;
 IF nullif(trim(_inv.email),'') IS NOT NULL AND lower(trim(_inv.email))<>lower(trim(NEW.email)) THEN RAISE EXCEPTION 'Use the email account named on this invitation'; END IF;
 INSERT INTO public.users(id,company_id,full_name,email,role) VALUES(NEW.id,_inv.company_id,left(_full_name,200),NEW.email,(CASE WHEN _inv.role IN('superuser','admin') THEN 'admin' WHEN _inv.role='maintenance' THEN 'technician' ELSE _inv.role::text END)::public.user_role);
 INSERT INTO public.user_roles(user_id,company_id,role) VALUES(NEW.id,_inv.company_id,_inv.role);
 UPDATE public.company_invites SET used_at=now(),used_by=NEW.id WHERE id=_inv.id; RETURN NEW;
 END IF;
 IF _company_name IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.companies(name) VALUES(left(_company_name,200)) RETURNING id INTO _company_id;
 INSERT INTO public.users(id,company_id,full_name,email,role) VALUES(NEW.id,_company_id,left(_full_name,200),NEW.email,'admin');
 INSERT INTO public.user_roles(user_id,company_id,role) VALUES(NEW.id,_company_id,'superuser'); RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.accept_company_invite_named(_token text,_first_name text,_surname text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); inv public.company_invites; account_email text; verified_at timestamptz; person_name text;
BEGIN
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
 INSERT INTO public.users(id,company_id,full_name,email,role) VALUES(uid,inv.company_id,person_name,account_email,(CASE WHEN inv.role IN('superuser','admin') THEN 'admin' WHEN inv.role='maintenance' THEN 'technician' ELSE inv.role::text END)::public.user_role);
 INSERT INTO public.user_roles(user_id,company_id,role) VALUES(uid,inv.company_id,inv.role);
 UPDATE public.company_invites SET used_at=now(),used_by=uid WHERE id=inv.id; RETURN inv.company_id;
END $$;
CREATE OR REPLACE FUNCTION public.registered_members() RETURNS TABLE(id uuid,full_name text,email text,employee_id text,role public.app_role,platform_owner boolean,created_at timestamptz,registration_status text,terminated_at timestamptz,termination_reason text,providers text[]) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE me public.app_role:=public.my_role(); BEGIN IF NOT public.is_company_manager() THEN RAISE EXCEPTION 'Only managers can view registered members'; END IF; RETURN QUERY SELECT u.id,u.full_name,u.email,u.employee_id,r.role,r.platform_owner,u.created_at,r.registration_status,r.terminated_at,CASE WHEN public.has_company_role('admin') THEN r.termination_reason ELSE NULL END,ARRAY(SELECT DISTINCT i.provider::text FROM auth.identities i WHERE i.user_id=u.id) FROM public.users u JOIN public.user_roles r ON r.user_id=u.id AND r.company_id=u.company_id WHERE u.company_id=public.current_company_id() AND (me='superuser' OR (me='admin' AND r.role IN('admin','supervisor','technician','maintenance')) OR (me='supervisor' AND r.role IN('supervisor','technician','maintenance'))) ORDER BY u.full_name; END $$;
CREATE OR REPLACE FUNCTION public.guard_member_skill_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=NEW.user_id AND r.company_id=NEW.company_id AND r.role IN('technician','supervisor','maintenance') AND public.member_is_active(r.user_id)) OR NOT EXISTS(SELECT 1 FROM public.company_skills s WHERE s.id=NEW.skill_id AND s.company_id=NEW.company_id AND NOT s.archived) THEN RAISE EXCEPTION 'Skills require active field staff and a company skill'; END IF; NEW.assigned_by=auth.uid(); RETURN NEW; END $$;