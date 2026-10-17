ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS property_name text, ADD COLUMN IF NOT EXISTS street_name text, ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.client_contacts ADD COLUMN IF NOT EXISTS receives_job_sheets boolean NOT NULL DEFAULT false;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS serial_number text;
UPDATE public.client_contacts SET receives_job_sheets = true WHERE is_primary_contact;