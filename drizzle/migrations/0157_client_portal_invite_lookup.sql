CREATE OR REPLACE FUNCTION public.get_client_portal_invite(_token text)
RETURNS TABLE(email text, company_name text, valid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT i.email, c.name, true FROM public.client_portal_invites i JOIN public.companies c ON c.id=i.company_id
  WHERE _token ~ '^[a-f0-9]{64}$' AND i.token_hash=encode(extensions.digest(_token,'sha256'),'hex')
    AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_client_portal_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_client_portal_invite(text) TO anon, authenticated;