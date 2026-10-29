CREATE TABLE public.bell_push_runner (id boolean PRIMARY KEY DEFAULT true CHECK(id), lease_until timestamptz NOT NULL);
GRANT ALL ON public.bell_push_runner TO service_role;
ALTER TABLE public.bell_push_runner ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.acquire_bell_push_runner() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE got boolean; BEGIN INSERT INTO public.bell_push_runner(id,lease_until) VALUES(true,now()+interval '5 minutes') ON CONFLICT(id) DO UPDATE SET lease_until=excluded.lease_until WHERE bell_push_runner.lease_until<now() RETURNING id INTO got; RETURN coalesce(got,false); END $$;
CREATE FUNCTION public.release_bell_push_runner() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.bell_push_runner SET lease_until=now() WHERE id=true; $$;
REVOKE ALL ON FUNCTION public.acquire_bell_push_runner(),public.release_bell_push_runner() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_bell_push_runner(),public.release_bell_push_runner() TO service_role;