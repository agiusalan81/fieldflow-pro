BEGIN;
DO $$
DECLARE actor uuid; tenant uuid; sheet uuid; category uuid; receipt uuid; office uuid; original jsonb;
BEGIN
 SELECT user_id,company_id INTO actor,tenant FROM public.user_roles WHERE user_id='6aaa2386-ced1-4579-99b8-774a19128698' AND registration_status='active';
 IF actor IS NULL THEN RAISE EXCEPTION 'Requesting active account required'; END IF;
 SELECT id,to_jsonb(j) INTO sheet,original FROM public.job_sheets j WHERE company_id=tenant AND assigned_technician_id=actor AND status='completed' LIMIT 1;
 IF sheet IS NULL THEN RAISE EXCEPTION 'Completed sheet fixture required'; END IF;
 SELECT user_id INTO office FROM public.user_roles WHERE company_id=tenant AND role IN ('admin','superuser') AND registration_status='active' LIMIT 1;
 IF office IS NULL THEN RAISE EXCEPTION 'Office fixture required'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.expense_categories(name) VALUES ('Test rollback category '||gen_random_uuid()) RETURNING id INTO category;
 BEGIN
 UPDATE public.expense_categories SET status='approved' WHERE id=category;
 IF FOUND THEN RAISE EXCEPTION 'Technician approved a category'; END IF;
 END;
 receipt=gen_random_uuid();
 INSERT INTO public.expense_receipts(id,file_path) VALUES (receipt,tenant::text||'/expenses/'||receipt::text||'.pdf');
 BEGIN
 UPDATE public.expense_receipts SET category_id=category WHERE id=receipt;
 RAISE EXCEPTION 'Pending category accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Pending category accepted' THEN RAISE; END IF; END;
 INSERT INTO public.jobsheet_receipts(company_id,jobsheet_id,uploaded_by,file_path,page_count,expense_id) VALUES (tenant,sheet,actor,tenant::text||'/expenses/'||receipt::text||'.pdf',1,receipt);
 INSERT INTO public.jobsheet_internal_notes(jobsheet_id,body) VALUES (sheet,'Rollback-only completed-sheet note');
 IF (SELECT to_jsonb(j) FROM public.job_sheets j WHERE id=sheet) IS DISTINCT FROM original THEN RAISE EXCEPTION 'Signed sheet modified by internal additions'; END IF;
 BEGIN UPDATE public.expense_receipts SET file_path='changed' WHERE id=receipt; RAISE EXCEPTION 'Receipt evidence changed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Receipt evidence changed' THEN RAISE; END IF; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',office::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.expense_categories SET name='Approved rollback category '||category,status='approved' WHERE id=category;
 IF NOT FOUND THEN RAISE EXCEPTION 'Office category approval failed'; END IF;
 UPDATE public.expense_receipts SET category_id=category WHERE id=receipt;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved category assignment failed'; END IF;
 RESET ROLE;
END $$;
ROLLBACK;
