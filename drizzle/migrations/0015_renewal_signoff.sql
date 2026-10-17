ALTER TABLE public.maintenance_agreements
  ADD COLUMN IF NOT EXISTS renewal_signature text,
  ADD COLUMN IF NOT EXISTS renewal_signed_by text,
  ADD COLUMN IF NOT EXISTS renewal_signed_at timestamptz;