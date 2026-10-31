DO $$ DECLARE definition text; BEGIN
SELECT pg_get_functiondef('public.guard_branding_settings()'::regprocedure) INTO definition;
definition=replace(definition, 'prior_pdf->''fontName'');', 'prior_pdf->''fontName'',prior_pdf->''customFonts'');');
definition=replace(definition, 'NEW.pdf_template->''fontName'');', 'NEW.pdf_template->''fontName'',NEW.pdf_template->''customFonts'');');
definition=replace(definition, '''backgroundPath'',''fieldBackground''', '''backgroundPath'',''backgroundOpacity'',''backgroundTone'',''backgroundBrightness'',''textStyles'',''fieldBackground''');
EXECUTE definition;
SELECT pg_get_functiondef('public.issue_client_billing(uuid)'::regprocedure) INTO definition;
definition=replace(definition, '''kind'',d.kind,''reference'',ref', '''template'',cs.pdf_template,''kind'',d.kind,''reference'',ref');
EXECUTE definition;
SELECT pg_get_functiondef('public.customer_quote_action(uuid,text,jsonb)'::regprocedure) INTO definition;
definition=replace(definition, '''reference'',q.reference,''revision'',q.revision', '''template'',settings.pdf_template,''reference'',q.reference,''revision'',q.revision');
EXECUTE definition;
END $$;
CREATE OR REPLACE FUNCTION public.guard_document_font_paths() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE f jsonb; BEGIN
IF NEW.pdf_template IS NOT DISTINCT FROM OLD.pdf_template THEN RETURN NEW; END IF;
IF jsonb_typeof(NEW.pdf_template->'customFonts')='array' THEN
IF jsonb_array_length(NEW.pdf_template->'customFonts')>30 THEN RAISE EXCEPTION 'At most 30 company fonts'; END IF;
FOR f IN SELECT value FROM jsonb_array_elements(NEW.pdf_template->'customFonts') LOOP
IF coalesce(f->>'path','') !~ ('^'||NEW.company_id::text||'/fonts/[a-zA-Z0-9_.-]+$') OR length(trim(coalesce(f->>'name','')))=0 OR length(f->>'name')>80 OR coalesce(f->>'id','') !~ '^[a-zA-Z0-9_-]+$' OR f ? 'data' THEN RAISE EXCEPTION 'Choose a named font uploaded by this company'; END IF;
END LOOP; END IF;
RETURN NEW; END $$;
CREATE TRIGGER company_document_font_paths BEFORE UPDATE OF pdf_template ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.guard_document_font_paths();
COMMENT ON COLUMN public.client_billing_settings.defaults IS 'Canonical shared payment terms, methods and structured bank details for new drafts. Per-kind terms live in company_settings.terms; issued financial and branding snapshots remain immutable.';