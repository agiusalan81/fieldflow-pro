-- Rollback-only private QR evidence and closure audit checks.
BEGIN;
DO $$
DECLARE tenant uuid; asset uuid; token text:=repeat('a',64); link uuid; grant_id uuid; report uuid; timestamped timestamptz;
BEGIN
 SELECT company_id,id INTO tenant,asset FROM public.assets ORDER BY id LIMIT 1;
 IF asset IS NULL THEN RAISE EXCEPTION 'Equipment fixture required'; END IF;
 INSERT INTO public.equipment_report_links(company_id,asset_id,token_hash) VALUES(tenant,asset,encode(sha256(token::bytea),'hex')) RETURNING id INTO link;
 grant_id:=(public.reserve_qr_photo(token,'equipment')->>'id')::uuid;
 BEGIN
   PERFORM public.submit_qr_photo_report(repeat('b',64),'equipment',grant_id,'{}');
   RAISE EXCEPTION 'Wrong-token attachment accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Wrong-token attachment accepted' THEN RAISE; END IF; END;
 BEGIN
   PERFORM public.submit_qr_photo_report(token,'equipment',grant_id,jsonb_build_object('first','Test','last','QR','position','Test','problem','Test fault'));
   RAISE EXCEPTION 'Missing-object attachment accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Missing-object attachment accepted' THEN RAISE; END IF; IF SQLERRM<>'Photo upload incomplete' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.equipment_problem_reports WHERE company_id=tenant AND first_name='Test' AND last_name='QR' AND problem='Test fault') THEN RAISE EXCEPTION 'Failed attachment created report'; END IF;
 UPDATE public.qr_report_photos SET expires_at=now()-interval '1 minute' WHERE id=grant_id;
 BEGIN
   PERFORM public.submit_qr_photo_report(token,'equipment',grant_id,'{}');
   RAISE EXCEPTION 'Expired attachment accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Expired attachment accepted' THEN RAISE; END IF; END;
 INSERT INTO public.equipment_problem_reports(company_id,asset_id,first_name,last_name,position,problem) VALUES(tenant,asset,'Audit','Test','Test','Closure audit') RETURNING id INTO report;
 UPDATE public.equipment_problem_reports SET status='closed',closed_at='2000-01-01' WHERE id=report;
 SELECT closed_at INTO timestamped FROM public.equipment_problem_reports WHERE id=report;
 IF timestamped<now()-interval '1 minute' THEN RAISE EXCEPTION 'Closure timestamp accepted caller input'; END IF;
 UPDATE public.equipment_problem_reports SET closed_at='2000-01-01' WHERE id=report;
 IF (SELECT closed_at FROM public.equipment_problem_reports WHERE id=report)<>timestamped THEN RAISE EXCEPTION 'Closure audit was mutable'; END IF;
 IF has_table_privilege('anon','public.qr_report_photos','SELECT') OR has_table_privilege('authenticated','public.qr_report_photos','SELECT') THEN RAISE EXCEPTION 'Photo paths exposed'; END IF;
 IF has_function_privilege('anon','public.reserve_qr_photo(text,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous upload reservation exposed'; END IF;
END $$;
ROLLBACK;