CREATE OR REPLACE FUNCTION public.guard_leave_operational_review()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE blackout boolean; BEGIN
SELECT EXISTS(SELECT 1 FROM public.leave_blackouts b JOIN public.user_roles r ON r.user_id=NEW.user_id AND r.company_id=b.company_id WHERE b.company_id=NEW.company_id AND r.role=ANY(b.roles) AND b.start_date<=NEW.end_date AND b.end_date>=NEW.start_date) INTO blackout;
IF TG_OP='INSERT' AND NEW.leave_type='Annual' AND blackout AND coalesce(trim(NEW.exception_reason),'')='' THEN RAISE EXCEPTION 'Annual leave overlaps a restricted period. Add an exception reason.'; END IF;
IF TG_OP='UPDATE' THEN
IF NEW.status='approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
IF NEW.leave_type='Annual' AND blackout AND NOT(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser')) THEN RAISE EXCEPTION 'An Office Admin must approve blackout exceptions'; END IF;
IF (EXISTS(SELECT 1 FROM public.jobs WHERE company_id=NEW.company_id AND scheduled_date BETWEEN NEW.start_date AND NEW.end_date AND (assigned_technician_id=NEW.user_id OR secondary_technician_id=NEW.user_id)) OR EXISTS(SELECT 1 FROM generate_series(NEW.start_date::timestamp,NEW.end_date::timestamp,interval '1 day') d WHERE public.is_on_standby(NEW.user_id,d::date))) AND coalesce(trim(NEW.work_handling_note),'')='' AND coalesce(trim(NEW.supervisor_response),'')='' THEN RAISE EXCEPTION 'Record how scheduled jobs and on-call duties will be handled'; END IF;
END IF;
IF (NEW.exception_reason IS DISTINCT FROM OLD.exception_reason OR NEW.work_handling_note IS DISTINCT FROM OLD.work_handling_note OR NEW.consulted_supervisor_id IS DISTINCT FROM OLD.consulted_supervisor_id) AND NOT public.is_company_manager() THEN RAISE EXCEPTION 'Manager access required'; END IF;
IF NEW.supervisor_response IS DISTINCT FROM OLD.supervisor_response AND auth.uid() IS DISTINCT FROM OLD.consulted_supervisor_id THEN RAISE EXCEPTION 'Only the consulted supervisor can respond'; END IF;
END IF;
IF NEW.consulted_supervisor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE company_id=NEW.company_id AND user_id=NEW.consulted_supervisor_id AND role IN ('supervisor','admin','superuser') AND public.member_is_active(user_id)) THEN RAISE EXCEPTION 'Choose an active company supervisor or manager'; END IF; RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.guard_expense_record()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$ BEGIN
IF NOT public.company_module_access(NEW.company_id,'receipts') THEN RAISE EXCEPTION 'Receipt module is unavailable'; END IF;
IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'category_id') IS DISTINCT FROM (to_jsonb(OLD)-'category_id') THEN RAISE EXCEPTION 'Receipt evidence is immutable'; END IF;
IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.expense_categories c WHERE c.id=NEW.category_id AND c.company_id=NEW.company_id AND (c.status='approved' OR (c.status='pending' AND (c.proposed_by=auth.uid() OR auth.uid() IS NULL OR public.my_role() IN ('admin','superuser','supervisor'))))) THEN RAISE EXCEPTION 'Choose an approved category'; END IF;
RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.clear_rejected_expense_category()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
IF NEW.status='rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
UPDATE public.expense_receipts SET category_id=NULL WHERE category_id=NEW.id AND company_id=NEW.company_id;
END IF; RETURN NEW; END $function$;
DROP TRIGGER IF EXISTS expense_category_rejected ON public.expense_categories;
CREATE TRIGGER expense_category_rejected AFTER UPDATE OF status ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION public.clear_rejected_expense_category();

DROP POLICY IF EXISTS category_read ON public.expense_categories;
CREATE POLICY category_read ON public.expense_categories FOR SELECT TO authenticated USING ((company_id = current_company_id()) AND member_is_active(auth.uid()) AND company_module_access(company_id, 'receipts') AND ((status = 'approved') OR (proposed_by = auth.uid()) OR (my_role() = ANY (ARRAY['admin'::app_role, 'superuser'::app_role, 'supervisor'::app_role]))));
DROP POLICY IF EXISTS category_review ON public.expense_categories;
CREATE POLICY category_review ON public.expense_categories FOR UPDATE TO authenticated USING ((company_id = current_company_id()) AND (my_role() = ANY (ARRAY['admin'::app_role, 'superuser'::app_role, 'supervisor'::app_role])) AND member_is_active(auth.uid()) AND company_module_access(company_id, 'receipts')) WITH CHECK (company_id = current_company_id());