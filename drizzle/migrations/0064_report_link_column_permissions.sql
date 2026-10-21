REVOKE UPDATE ON public.equipment_report_links FROM authenticated;
GRANT UPDATE(revoked_at) ON public.equipment_report_links TO authenticated;
REVOKE UPDATE ON public.equipment_problem_reports FROM authenticated;
GRANT UPDATE(status) ON public.equipment_problem_reports TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_attention_metadata() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='DELETE' THEN RETURN OLD; END IF;
IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id) THEN RAISE EXCEPTION 'Record identity cannot change'; END IF;
IF TG_TABLE_NAME='equipment_report_links' THEN
IF NEW.asset_id IS DISTINCT FROM OLD.asset_id OR NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Reporting label identity cannot change'; END IF;
ELSIF TG_TABLE_NAME='equipment_problem_reports' THEN
IF NEW.asset_id IS DISTINCT FROM OLD.asset_id OR NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name OR NEW.position IS DISTINCT FROM OLD.position OR NEW.problem IS DISTINCT FROM OLD.problem OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Submitted report is immutable';END IF;
IF NEW.status NOT IN ('open','closed') THEN RAISE EXCEPTION 'Invalid report status';END IF;
END IF;RETURN NEW; END $$;