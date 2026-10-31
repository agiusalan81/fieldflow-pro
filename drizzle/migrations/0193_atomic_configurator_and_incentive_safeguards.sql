CREATE FUNCTION public.populate_space_assets(_site uuid,_rows jsonb) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c uuid:=public.current_company_id(); s public.sites; r public.company_identifier_rules; item jsonb; tag text; lead text; n bigint:=0; a uuid; ids uuid[]:='{}'; BEGIN
 IF NOT public.member_is_active(auth.uid()) OR NOT public.is_company_manager() THEN RAISE EXCEPTION 'Manager access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.companies co JOIN public.platform_products p ON p.id=co.product_id WHERE co.id=c AND p.slug IN ('fieldbridge_hotels','aisleops')) THEN RAISE EXCEPTION 'Available for Hotels and AisleOps only'; END IF;
 SELECT * INTO s FROM public.sites WHERE id=_site AND company_id=c; IF NOT FOUND THEN RAISE EXCEPTION 'Choose a valid property first'; END IF;
 IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Choose between 1 and 10000 items per batch'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c::text||':asset-identifiers',0));
 SELECT * INTO r FROM public.company_identifier_rules WHERE company_id=c AND kind='asset';
 IF FOUND THEN IF r.pattern_type<>'numeric' THEN RAISE EXCEPTION 'Automatic asset creation requires a number sequence in company ID formats'; END IF; lead:=r.prefix||r.separator; SELECT coalesce(max(substr(reference_number,length(lead)+1)::bigint),0) INTO n FROM public.assets WHERE company_id=c AND left(reference_number,length(lead))=lead AND substr(reference_number,length(lead)+1) ~ '^[0-9]{1,12}$'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(_rows) LOOP
 IF length(coalesce(item->>'asset_category','')) NOT BETWEEN 1 AND 200 OR length(coalesce(item->>'location_details','')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter equipment and location'; END IF;
 IF r.company_id IS NOT NULL THEN n:=n+1;tag:=lead||lpad(n::text,greatest(r.padding,length(n::text)),'0'); ELSE tag:=trim(item->>'reference_number'); END IF;
 IF tag IS NULL OR tag='' OR EXISTS(SELECT 1 FROM public.assets WHERE company_id=c AND reference_number=tag) THEN RAISE EXCEPTION 'Duplicate or missing asset ID: %. Set an asset numbering rule or change the layout',tag; END IF;
 INSERT INTO public.assets(company_id,client_id,site_id,reference_number,asset_category,location_details) VALUES(c,s.client_id,s.id,tag,item->>'asset_category',item->>'location_details') RETURNING id INTO a; ids:=array_append(ids,a);
 END LOOP; RETURN ids;
END $$;
REVOKE ALL ON FUNCTION public.populate_space_assets(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.populate_space_assets(uuid,jsonb) TO authenticated;
ALTER TABLE public.jobs ADD COLUMN incentive_set_by uuid;
CREATE FUNCTION public.guard_incentive_self_dealing() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.claim_incentive_cents IS DISTINCT FROM OLD.claim_incentive_cents OR NEW.claim_incentive_override IS DISTINCT FROM OLD.claim_incentive_override) AND EXISTS(SELECT 1 FROM public.job_claim_incentives WHERE job_id=NEW.id) THEN RAISE EXCEPTION 'Bonus is frozen after the first claim'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.claim_incentive_override OR NEW.claim_incentive_cents>0 THEN IF NOT public.member_dispatch_can() THEN RAISE EXCEPTION 'Dispatch access required'; END IF; NEW.incentive_set_by:=auth.uid(); END IF;
 ELSE
  IF NEW.claim_incentive_override AND (NEW.claim_incentive_cents IS DISTINCT FROM OLD.claim_incentive_cents OR NEW.claim_incentive_override IS DISTINCT FROM OLD.claim_incentive_override) THEN IF NOT public.member_dispatch_can() THEN RAISE EXCEPTION 'Dispatch access required'; END IF;NEW.incentive_set_by:=auth.uid(); ELSE NEW.incentive_set_by:=OLD.incentive_set_by; END IF;
 END IF;
 IF NOT NEW.claim_incentive_override THEN NEW.incentive_set_by:=NULL; END IF;
 IF NEW.claim_incentive_override AND public.has_role(NEW.incentive_set_by,'supervisor') AND (NEW.incentive_set_by IN (NEW.assigned_technician_id,NEW.secondary_technician_id) OR EXISTS(SELECT 1 FROM public.job_crew WHERE job_id=NEW.id AND user_id=NEW.incentive_set_by)) THEN RAISE EXCEPTION 'Supervisors cannot set an incentive for themselves. Use the company default or ask office staff'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aa_incentive_self_guard BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_incentive_self_dealing();
CREATE FUNCTION public.guard_crew_incentive_self_dealing() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j public.jobs; BEGIN
 SELECT * INTO j FROM public.jobs WHERE id=NEW.job_id FOR UPDATE;
 IF j.claim_incentive_override AND public.has_role(NEW.user_id,'supervisor') AND (j.incentive_set_by=NEW.user_id OR j.incentive_set_by IS NULL) THEN RAISE EXCEPTION 'Office review required before claiming your own or a legacy incentive override'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER crew_self_incentive_guard BEFORE INSERT OR UPDATE ON public.job_crew FOR EACH ROW EXECUTE FUNCTION public.guard_crew_incentive_self_dealing();
DO $$ DECLARE f text; old text:='IF NOT FOUND THEN RAISE EXCEPTION ''Job not found''; END IF;'; BEGIN
 f:=pg_get_functiondef('public.claim_open_job(uuid)'::regprocedure);
 IF position(old in f)=0 THEN RAISE EXCEPTION 'Claim security insertion point missing'; END IF;
 f:=replace(f,old,old||' IF public.has_role(me,''supervisor'') AND j.claim_incentive_override AND (j.incentive_set_by=me OR j.incentive_set_by IS NULL) THEN RAISE EXCEPTION ''Office review required before claiming your own or a legacy incentive override''; END IF;');EXECUTE f;
END $$;
ALTER TABLE public.job_claim_incentives ADD COLUMN payslip_id uuid REFERENCES public.payroll_payslips(id);
CREATE FUNCTION public.guard_payroll_incentives() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE ids jsonb; expected jsonb; cents bigint; BEGIN
 IF NOT public.member_is_active(auth.uid()) OR public.my_role() NOT IN ('admin','superuser') THEN RAISE EXCEPTION 'Office payroll access required'; END IF;
 PERFORM 1 FROM public.users WHERE id=NEW.user_id AND company_id=NEW.company_id FOR UPDATE;
 SELECT coalesce(jsonb_agg(id::text ORDER BY id),'[]'::jsonb),coalesce(sum(amount_cents),0) INTO expected,cents FROM public.job_claim_incentives WHERE company_id=NEW.company_id AND user_id=NEW.user_id AND earned_at>=NEW.period_start::timestamptz AND earned_at<(NEW.period_end+1)::timestamptz AND payslip_id IS NULL;
 ids:=NEW.snapshot->'claimIncentives'->'ids';
 IF cents>0 OR ids IS NOT NULL THEN
  IF coalesce(ids,'[]'::jsonb) IS DISTINCT FROM expected OR coalesce((NEW.snapshot->'claimIncentives'->>'amountCents')::bigint,-1)<>cents THEN RAISE EXCEPTION 'Earned incentives changed. Refresh payroll and review again'; END IF;
  IF coalesce(NEW.snapshot->>'currency','EUR')<>'EUR' AND cents>0 THEN RAISE EXCEPTION 'Euro claim incentives require EUR payroll; no exchange rate is configured'; END IF;
  IF coalesce((NEW.snapshot->'adjustments'->>'bonus')::numeric,0)<cents/100.0 THEN RAISE EXCEPTION 'Claim incentives must be included in wages'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER payroll_claim_validation BEFORE INSERT ON public.payroll_payslips FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_incentives();
CREATE FUNCTION public.link_payroll_incentives() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE public.job_claim_incentives SET payslip_id=NEW.id WHERE company_id=NEW.company_id AND user_id=NEW.user_id AND earned_at>=NEW.period_start::timestamptz AND earned_at<(NEW.period_end+1)::timestamptz AND payslip_id IS NULL;RETURN NEW;
END $$;
CREATE TRIGGER payroll_claim_link AFTER INSERT ON public.payroll_payslips FOR EACH ROW EXECUTE FUNCTION public.link_payroll_incentives();