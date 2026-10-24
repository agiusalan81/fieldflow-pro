-- Public QR logbook: safe, bounded projection, only when the Client Experience pack is on.
CREATE OR REPLACE FUNCTION public.get_equipment_logbook(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'company', c.name,
    'visits', COALESCE((SELECT jsonb_agg(v ORDER BY v->>'date' DESC) FROM (
       SELECT jsonb_build_object('date', COALESCE(s.work_end_time, s.created_at)::date, 'number', s.jobsheet_number,
         'type', CASE WHEN s.is_maintenance THEN 'Maintenance' WHEN s.is_installation THEN 'Installation' WHEN s.is_tech_assistance THEN 'Technical assistance' ELSE 'Service visit' END) v
       FROM public.job_sheets s WHERE s.asset_id = a.id AND s.company_id = a.company_id AND s.status = 'completed'
       ORDER BY COALESCE(s.work_end_time, s.created_at) DESC LIMIT 12) x), '[]'::jsonb),
    'next_visit', (SELECT min(j.scheduled_date) FROM public.jobs j WHERE j.asset_id = a.id AND j.company_id = a.company_id AND j.scheduled_date >= current_date))
  FROM public.equipment_report_links l
  JOIN public.assets a ON a.id = l.asset_id AND a.company_id = l.company_id
  JOIN public.companies c ON c.id = l.company_id
  WHERE _token ~ '^[a-f0-9]{64}$' AND l.token_hash = encode(sha256(_token::bytea), 'hex') AND l.revoked_at IS NULL
    AND public.company_module_access(l.company_id, 'client_portal')
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_equipment_logbook(text) TO anon, authenticated;

-- Online proposal approval links (hashed, expiring, revocable) with an immutable decision snapshot.
CREATE TABLE public.proposal_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  revoked_at timestamptz,
  decision text CHECK (decision IN ('accepted','declined')),
  signer_name text,
  signer_comment text,
  decided_at timestamptz,
  snapshot jsonb NOT NULL
);
GRANT SELECT ON public.proposal_approvals TO authenticated;
GRANT ALL ON public.proposal_approvals TO service_role;
ALTER TABLE public.proposal_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read own company approvals" ON public.proposal_approvals FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager() AND public.member_is_active(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_proposal_approval_link(_proposal uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); c uuid := public.current_company_id(); p record;
BEGIN
  IF NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() OR NOT public.company_module_access(c,'client_portal') THEN RAISE EXCEPTION 'Client Experience pack and manager access required'; END IF;
  SELECT pr.*, cl.name AS client_name INTO p FROM public.proposals pr LEFT JOIN public.clients cl ON cl.id = pr.client_id WHERE pr.id = _proposal AND pr.company_id = c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
  IF p.status IN ('accepted','declined') THEN RAISE EXCEPTION 'Proposal already decided'; END IF;
  UPDATE public.proposal_approvals SET revoked_at = now() WHERE proposal_id = _proposal AND decided_at IS NULL AND revoked_at IS NULL;
  INSERT INTO public.proposal_approvals(company_id, proposal_id, token_hash, created_by, snapshot)
  VALUES (c, _proposal, encode(sha256(t::bytea),'hex'), auth.uid(),
    jsonb_build_object('reference', p.reference, 'title', p.title, 'client', p.client_name, 'lines', p.lines, 'terms', p.terms, 'company', (SELECT name FROM public.companies WHERE id = c)));
  UPDATE public.proposals SET status = 'sent' WHERE id = _proposal AND status = 'draft';
  RETURN t;
END $$;
GRANT EXECUTE ON FUNCTION public.create_proposal_approval_link(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.read_proposal_approval(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.snapshot || jsonb_build_object('decision', a.decision, 'decided_at', a.decided_at, 'signer_name', a.signer_name, 'expires_at', a.expires_at)
  FROM public.proposal_approvals a
  WHERE _token ~ '^[a-f0-9]{64}$' AND a.token_hash = encode(sha256(_token::bytea),'hex') AND a.revoked_at IS NULL
    AND (a.decided_at IS NOT NULL OR a.expires_at > now()) AND public.company_module_access(a.company_id,'client_portal')
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.read_proposal_approval(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.decide_proposal_approval(_token text, _decision text, _name text, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a record;
BEGIN
  IF _decision NOT IN ('accepted','declined') OR length(trim(coalesce(_name,''))) NOT BETWEEN 2 AND 120 OR length(coalesce(_comment,'')) > 1000 THEN RAISE EXCEPTION 'Invalid response'; END IF;
  SELECT * INTO a FROM public.proposal_approvals WHERE _token ~ '^[a-f0-9]{64}$' AND token_hash = encode(sha256(_token::bytea),'hex') FOR UPDATE;
  IF NOT FOUND OR a.revoked_at IS NOT NULL OR a.expires_at <= now() OR NOT public.company_module_access(a.company_id,'client_portal') THEN RAISE EXCEPTION 'This approval link is unavailable'; END IF;
  IF a.decided_at IS NOT NULL THEN RAISE EXCEPTION 'This proposal has already been answered'; END IF;
  UPDATE public.proposal_approvals SET decision = _decision, signer_name = trim(_name), signer_comment = nullif(trim(coalesce(_comment,'')),''), decided_at = now() WHERE id = a.id;
  UPDATE public.proposals SET status = _decision WHERE id = a.proposal_id;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_proposal_approval(text, text, text, text) TO anon, authenticated;