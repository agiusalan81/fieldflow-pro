ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS default_country_code text NOT NULL DEFAULT '+356',
  ADD COLUMN IF NOT EXISTS equipment_label text NOT NULL DEFAULT 'lift',
  ADD COLUMN IF NOT EXISTS equipment_categories text[] NOT NULL DEFAULT ARRAY['Elevator','Escalator','Custom'];