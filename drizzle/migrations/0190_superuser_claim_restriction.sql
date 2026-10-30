DO $$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.claim_open_job(uuid)'::regprocedure);
  IF position('Company Superusers cannot claim field jobs' in definition)=0 THEN
    IF position('BEGIN' in definition)=0 THEN RAISE EXCEPTION 'Claim function shape changed'; END IF;
    definition := regexp_replace(definition, 'BEGIN', E'BEGIN\n  IF public.has_role(auth.uid(), ''superuser'') THEN RAISE EXCEPTION ''Company Superusers cannot claim field jobs. Use a test technician account.''; END IF;');
    EXECUTE definition;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_open_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_open_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_open_job(uuid) TO service_role;