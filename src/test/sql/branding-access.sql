-- Run as a test transaction with active office/basic and technician fixtures.
-- No production memberships or subscriptions should be changed.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_settings_guard_branding' AND NOT tgisinternal) THEN RAISE EXCEPTION 'Branding guard missing'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Office branding uploads' AND with_check NOT LIKE '%has_company_role%') THEN RAISE EXCEPTION 'Font upload lacks protected office authority'; END IF;
  IF has_function_privilege('anon','public.branding_offers()','EXECUTE') THEN RAISE EXCEPTION 'Catalog offers leaked to anonymous callers'; END IF;
END $$;
ROLLBACK;