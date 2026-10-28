-- Run through an authenticated SQL test harness; all assertions roll back.
BEGIN;
DO $$ BEGIN
  IF position('is_platform_owner' in pg_get_functiondef('public.platform_clean_slate(uuid,text,boolean)'::regprocedure))=0 THEN RAISE EXCEPTION 'Full reset needs owner authorization'; END IF;
  IF position('Issued payslips must be retained' in pg_get_functiondef('public.platform_clean_slate(uuid,text,boolean)'::regprocedure))=0 THEN RAISE EXCEPTION 'Issued payroll must prevent reset'; END IF;
  IF position('DELETE FROM public.users' in pg_get_functiondef('public.platform_clean_slate(uuid,text,boolean)'::regprocedure))>0 THEN RAISE EXCEPTION 'User accounts must remain'; END IF;
  IF position('DELETE FROM public.company_settings' in pg_get_functiondef('public.platform_clean_slate(uuid,text,boolean)'::regprocedure))>0 THEN RAISE EXCEPTION 'Branding must remain'; END IF;
  IF position('DELETE FROM public.platform_invoices' in pg_get_functiondef('public.platform_clean_slate(uuid,text,boolean)'::regprocedure))>0 THEN RAISE EXCEPTION 'Platform billing must remain'; END IF;
END $$;
ROLLBACK;