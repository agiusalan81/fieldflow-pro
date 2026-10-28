CREATE TABLE public.passport_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
 asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE, submitted_by uuid NOT NULL DEFAULT auth.uid(),
 title text NOT NULL DEFAULT '', component text NOT NULL DEFAULT 'general', notes text NOT NULL DEFAULT '', blocks jsonb NOT NULL DEFAULT '{}',
 file_path text, file_type text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_by uuid, reviewed_at timestamptz
);
GRANT SELECT, INSERT ON public.passport_submissions TO authenticated;
GRANT ALL ON public.passport_submissions TO service_role;
ALTER TABLE public.passport_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY passport_submission_read ON public.passport_submissions FOR SELECT TO authenticated USING(company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND (status='approved' OR submitted_by=auth.uid() OR public.is_company_manager()));
CREATE POLICY passport_submission_insert ON public.passport_submissions FOR INSERT TO authenticated WITH CHECK(company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND submitted_by=auth.uid() AND status='draft' AND reviewed_by IS NULL AND reviewed_at IS NULL);
CREATE FUNCTION public.guard_passport_submission() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.assets WHERE id=NEW.asset_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Equipment unavailable'; END IF;
 IF length(NEW.title)>160 OR length(NEW.notes)>10000 OR length(NEW.component)>80 OR jsonb_typeof(NEW.blocks)<>'object' OR octet_length(NEW.blocks::text)>50000 THEN RAISE EXCEPTION 'Invalid technical submission'; END IF;
 IF NEW.file_path IS NOT NULL AND NEW.file_path<>NEW.company_id::text||'/'||NEW.submitted_by::text||'/'||NEW.id::text THEN RAISE EXCEPTION 'Invalid evidence path'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER passport_submission_validate BEFORE INSERT OR UPDATE ON public.passport_submissions FOR EACH ROW EXECUTE FUNCTION public.guard_passport_submission();
CREATE TRIGGER passport_submission_module BEFORE INSERT OR UPDATE OR DELETE ON public.passport_submissions FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('lift_pack');
CREATE POLICY passport_evidence_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='passport-evidence' AND EXISTS(SELECT 1 FROM public.passport_submissions s WHERE s.file_path=name AND s.company_id=public.current_company_id() AND s.submitted_by=auth.uid() AND s.status='draft' AND public.member_is_active(auth.uid()) AND public.company_module_access(s.company_id,'lift_pack')));
CREATE POLICY passport_evidence_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='passport-evidence' AND EXISTS(SELECT 1 FROM public.passport_submissions s WHERE s.file_path=name AND s.company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND (s.status='approved' OR s.submitted_by=auth.uid() OR public.is_company_manager())));
CREATE FUNCTION public.submit_passport_handover(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.passport_submissions; BEGIN
 SELECT * INTO s FROM public.passport_submissions WHERE id=_id AND company_id=public.current_company_id() AND submitted_by=auth.uid() AND status='draft' FOR UPDATE;
 IF s.id IS NULL OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Submission unavailable'; END IF;
 IF s.file_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='passport-evidence' AND name=s.file_path) THEN RAISE EXCEPTION 'Upload the file before submitting'; END IF;
 IF s.file_path IS NULL AND s.blocks='{}'::jsonb AND btrim(s.notes)='' THEN RAISE EXCEPTION 'Add technical details or a file'; END IF;
 UPDATE public.passport_submissions SET status='pending' WHERE id=s.id;
 END $$;
CREATE FUNCTION public.review_passport_handover(_id uuid,_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.passport_submissions; k text; v jsonb; p uuid; BEGIN
 IF NOT public.is_company_manager() OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Manager review required'; END IF;
 SELECT * INTO s FROM public.passport_submissions WHERE id=_id AND company_id=public.current_company_id() AND status='pending' FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Pending submission unavailable'; END IF;
 IF _approve THEN
 IF s.file_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='passport-evidence' AND name=s.file_path) THEN RAISE EXCEPTION 'Evidence file unavailable'; END IF;
 INSERT INTO public.lift_passports(asset_id,company_id,equipment_type,general) SELECT a.id,a.company_id,CASE WHEN lower(a.asset_category) LIKE '%escalator%' THEN 'escalator' WHEN lower(a.asset_category) LIKE '%walk%' THEN 'moving_walk' ELSE 'lift' END,jsonb_build_object(CASE WHEN lower(a.asset_category) LIKE '%escalator%' OR lower(a.asset_category) LIKE '%walk%' THEN 'escalator_ref' ELSE 'lift_ref' END,a.reference_number,'serial_number',coalesce(a.serial_number,''),'location_details',coalesce(a.location_details,'')) FROM public.assets a WHERE a.id=s.asset_id ON CONFLICT(asset_id) DO NOTHING;
 SELECT id INTO p FROM public.lift_passports WHERE asset_id=s.asset_id AND company_id=s.company_id FOR UPDATE;
 FOR k,v IN SELECT key,value FROM jsonb_each(s.blocks) LOOP
 IF k NOT IN ('general','machine_drive','suspension_safety','controller_electronics','doors_cabin','escalator_geometry','escalator_steps_chains','escalator_handrail_balustrade') OR jsonb_typeof(v)<>'object' THEN RAISE EXCEPTION 'Invalid passport block'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(v) WHERE jsonb_typeof(value)<>'string' OR length(value#>>'{}')>500) THEN RAISE EXCEPTION 'Invalid passport value'; END IF;
 EXECUTE format('UPDATE public.lift_passports SET %I=%I || $1,updated_at=now() WHERE id=$2',k,k) USING v,p;
 END LOOP;
 END IF;
 UPDATE public.passport_submissions SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=s.id;
 END $$;
REVOKE ALL ON FUNCTION public.submit_passport_handover(uuid),public.review_passport_handover(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_passport_handover(uuid),public.review_passport_handover(uuid,boolean) TO authenticated;
CREATE INDEX passport_submissions_queue ON public.passport_submissions(company_id,status,asset_id);
