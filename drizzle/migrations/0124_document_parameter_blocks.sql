ALTER TABLE public.document_masters ADD COLUMN IF NOT EXISTS field_specs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.document_masters ADD COLUMN IF NOT EXISTS commercial jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.document_masters ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.document_masters.field_specs IS 'Digitised checklist controls per item: control type, audience, unit';
COMMENT ON COLUMN public.document_masters.commercial IS 'Optional commercial block: visits/year, base price, billing cycle, discounts, terms';
COMMENT ON COLUMN public.document_masters.extras IS 'Trade-specific key/value extension entries with audience';