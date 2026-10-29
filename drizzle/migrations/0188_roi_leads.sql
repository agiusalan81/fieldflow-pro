CREATE TABLE public.roi_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL DEFAULT 'fieldbridge-retail',
  email text NOT NULL CHECK (char_length(email) <= 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(inputs) < 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.roi_leads TO anon, authenticated;
GRANT ALL ON public.roi_leads TO service_role;
ALTER TABLE public.roi_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY roi_leads_public_insert ON public.roi_leads FOR INSERT TO anon, authenticated WITH CHECK (product IN ('fieldbridge-retail','fieldbridge-hotels','fieldbridge'));