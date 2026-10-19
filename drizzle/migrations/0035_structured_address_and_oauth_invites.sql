ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS office_address jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS vat_number text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.accept_company_invite(_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); inv public.company_invites; account_email text; verified_at timestamptz; person_name text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in before accepting your invitation'; END IF;
 IF _token IS NULL OR _token !~ '^[a-f0-9]{36}$' THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT email,email_confirmed_at,coalesce(nullif(trim(raw_user_meta_data->>'full_name'),''),split_part(email,'@',1)) INTO account_email,verified_at,person_name FROM auth.users WHERE id=uid;
 IF verified_at IS NULL THEN RAISE EXCEPTION 'Confirm your email before joining'; END IF;
 SELECT * INTO inv FROM public.company_invites WHERE token=_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
 IF inv.used_by=uid AND inv.used_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND company_id=inv.company_id) THEN RETURN inv.company_id; END IF;
 IF inv.used_at IS NOT NULL OR inv.expires_at<=now() THEN RAISE EXCEPTION 'Invitation expired or already used'; END IF;
 IF nullif(trim(inv.email),'') IS NOT NULL AND lower(trim(inv.email))<>lower(trim(account_email)) THEN RAISE EXCEPTION 'Use the email account named on this invitation'; END IF;
 IF EXISTS(SELECT 1 FROM public.users WHERE id=uid) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid) THEN RAISE EXCEPTION 'This account already belongs to a company. Use a different account; invitations cannot move existing memberships'; END IF;
 INSERT INTO public.users(id,company_id,full_name,email,role) VALUES(uid,inv.company_id,left(coalesce(nullif(inv.full_name,''),person_name),200),account_email,(CASE WHEN inv.role IN('superuser','admin') THEN 'admin' ELSE inv.role::text END)::public.user_role);
 INSERT INTO public.user_roles(user_id,company_id,role) VALUES(uid,inv.company_id,inv.role);
 UPDATE public.company_invites SET used_at=now(),used_by=uid WHERE id=inv.id;
 RETURN inv.company_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_company_invite(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_company_invite(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _company_name text:=nullif(trim(NEW.raw_user_meta_data->>'company_name'),''); _token text:=nullif(trim(NEW.raw_user_meta_data->>'invite_token'),''); _full_name text:=coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'),''),split_part(NEW.email,'@',1)); _company_id uuid; _inv public.company_invites;
BEGIN
 IF _token IS NOT NULL THEN
 SELECT * INTO _inv FROM public.company_invites WHERE token=_token AND used_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This invite link is invalid or has expired'; END IF;
 IF nullif(trim(_inv.email),'') IS NOT NULL AND lower(trim(_inv.email))<>lower(trim(NEW.email)) THEN RAISE EXCEPTION 'Use the email account named on this invitation'; END IF;
 INSERT INTO public.users(id,company_id,full_name,email,role) VALUES(NEW.id,_inv.company_id,left(_full_name,200),NEW.email,(CASE WHEN _inv.role IN('superuser','admin') THEN 'admin' ELSE _inv.role::text END)::public.user_role);
 INSERT INTO public.user_roles(user_id,company_id,role) VALUES(NEW.id,_inv.company_id,_inv.role);
 UPDATE public.company_invites SET used_at=now(),used_by=NEW.id WHERE id=_inv.id; RETURN NEW;
 END IF;
 IF _company_name IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.companies(name) VALUES(left(_company_name,200)) RETURNING id INTO _company_id;
 INSERT INTO public.users(id,company_id,full_name,email,role) VALUES(NEW.id,_company_id,left(_full_name,200),NEW.email,'admin');
 INSERT INTO public.user_roles(user_id,company_id,role) VALUES(NEW.id,_company_id,'superuser'); RETURN NEW;
END $$;