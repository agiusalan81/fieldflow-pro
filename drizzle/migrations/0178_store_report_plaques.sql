CREATE TABLE public.store_report_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  last_report_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.store_problem_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  reporter_type text NOT NULL DEFAULT 'staff' CHECK (reporter_type IN ('staff','visitor')),
  reporter_name text,
  category text NOT NULL,
  location text NOT NULL,
  problem text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.store_report_links TO authenticated;
GRANT SELECT, UPDATE ON public.store_problem_reports TO authenticated;
GRANT ALL ON public.store_report_links, public.store_problem_reports TO service_role;
ALTER TABLE public.store_report_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_problem_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read store links" ON public.store_report_links FOR SELECT TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Managers revoke store links" ON public.store_report_links FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager()) WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Managers read store reports" ON public.store_problem_reports FOR SELECT TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Managers close store reports" ON public.store_problem_reports FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager()) WITH CHECK (company_id = public.current_company_id());

CREATE OR REPLACE FUNCTION public.create_store_report_link(_site uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); c uuid := public.current_company_id();
BEGIN
  IF NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() OR NOT public.company_module_access(c,'core') OR NOT EXISTS(SELECT 1 FROM public.sites WHERE id=_site AND company_id=c) THEN RAISE EXCEPTION 'Manager access required'; END IF;
  INSERT INTO public.store_report_links(company_id,site_id,token_hash) VALUES(c,_site,encode(sha256(t::bytea),'hex'));
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.get_store_report_target(_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('store', s.name, 'company', co.name)
  FROM public.store_report_links l JOIN public.sites s ON s.id=l.site_id AND s.company_id=l.company_id JOIN public.companies co ON co.id=l.company_id
  WHERE _token ~ '^[a-f0-9]{64}$' AND l.token_hash=encode(sha256(_token::bytea),'hex') AND l.revoked_at IS NULL AND public.company_module_access(l.company_id,'core') LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_store_problem(_token text, _reporter_type text, _name text, _category text, _location text, _problem text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.store_report_links;
BEGIN
  IF _token !~ '^[a-f0-9]{64}$' OR _reporter_type NOT IN ('staff','visitor') OR length(trim(coalesce(_category,''))) NOT BETWEEN 1 AND 80 OR length(trim(coalesce(_location,''))) NOT BETWEEN 1 AND 200 OR length(trim(coalesce(_problem,''))) NOT BETWEEN 5 AND 2000 OR length(coalesce(_name,'')) > 100 OR (_reporter_type='staff' AND length(trim(coalesce(_name,'')))=0) THEN RAISE EXCEPTION 'Complete all report fields'; END IF;
  SELECT * INTO l FROM public.store_report_links WHERE token_hash=encode(sha256(_token::bytea),'hex') AND revoked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This reporting link is unavailable'; END IF;
  IF NOT public.company_module_access(l.company_id,'core') OR l.last_report_at > now()-interval '20 seconds' THEN RAISE EXCEPTION 'Reporting is temporarily unavailable. Please try again in a moment.'; END IF;
  INSERT INTO public.store_problem_reports(company_id,site_id,reporter_type,reporter_name,category,location,problem) VALUES(l.company_id,l.site_id,_reporter_type,nullif(trim(coalesce(_name,'')),''),trim(_category),trim(_location),trim(_problem));
  UPDATE public.store_report_links SET last_report_at=now() WHERE id=l.id;
END $$;
REVOKE ALL ON FUNCTION public.create_store_report_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_store_report_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_report_target(text), public.submit_store_problem(text,text,text,text,text,text) TO anon, authenticated;