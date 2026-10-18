ALTER TABLE public.clients ADD COLUMN preapprove_departure boolean NOT NULL DEFAULT false;
CREATE TABLE public.signing_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), client_id uuid NOT NULL REFERENCES public.clients(id), created_by uuid NOT NULL REFERENCES public.users(id), month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'), sheet_ids uuid[] NOT NULL, signed_ids uuid[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'signing' CHECK (status IN ('signing','sending','sent','failed','empty')), recipients text[] NOT NULL DEFAULT '{}', delivery_error text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.signing_batches TO authenticated;
GRANT ALL ON public.signing_batches TO service_role;
ALTER TABLE public.signing_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator reads batches" ON public.signing_batches FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND (created_by=auth.uid() OR public.is_company_manager()));
CREATE POLICY "Creator starts batches" ON public.signing_batches FOR INSERT TO authenticated WITH CHECK (company_id=public.current_company_id() AND created_by=auth.uid());
CREATE POLICY "Creator updates batches" ON public.signing_batches FOR UPDATE TO authenticated USING (company_id=public.current_company_id() AND created_by=auth.uid()) WITH CHECK (company_id=public.current_company_id() AND created_by=auth.uid());
CREATE FUNCTION public.guard_client_preapproval() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF (TG_OP='INSERT' AND NEW.preapprove_departure) OR (TG_OP='UPDATE' AND NEW.preapprove_departure IS DISTINCT FROM OLD.preapprove_departure) THEN IF NOT public.is_company_manager() THEN RAISE EXCEPTION 'Only office staff can change client departure pre-approval'; END IF; END IF; RETURN NEW; END $$;
CREATE TRIGGER clients_guard_preapproval BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.guard_client_preapproval();
CREATE FUNCTION public.save_sheet_snapshot(_id uuid, _expected timestamptz, _form jsonb, _logs jsonb, _parts jsonb) RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s public.job_sheets; v public.job_sheets; stamp timestamptz;
BEGIN
 SELECT * INTO s FROM public.job_sheets WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job sheet unavailable'; END IF;
 IF s.status='completed' THEN RAISE EXCEPTION 'Completed sheet is read-only'; END IF;
 IF s.updated_at IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'CONFLICT: this sheet changed on another device. Review before syncing'; END IF;
 v:=jsonb_populate_record(s,_form);
 UPDATE public.job_sheets SET client_id=v.client_id,site_id=v.site_id,asset_id=v.asset_id,asset_type=v.asset_type,asset_type_other=v.asset_type_other,lift_model=v.lift_model,serial_number=v.serial_number,requires_admin_approval=v.requires_admin_approval,is_tech_assistance=v.is_tech_assistance,is_maintenance=v.is_maintenance,is_installation=v.is_installation,job_type_other=v.job_type_other,maintenance_agreement_type=v.maintenance_agreement_type,reported_fault=v.reported_fault,repairs_performed=v.repairs_performed,pending_works_future_jobs=v.pending_works_future_jobs,internal_comments_admin_only=v.internal_comments_admin_only,technician_name=v.technician_name,client_full_name=v.client_full_name,client_id_card_no=v.client_id_card_no,signature_data=v.signature_data,special_notes=v.special_notes,special_notes_in_pdf=v.special_notes_in_pdf,special_notes_in_email=v.special_notes_in_email,checklist_values=v.checklist_values WHERE id=_id RETURNING updated_at INTO stamp;
 DELETE FROM public.jobsheet_time_logs WHERE jobsheet_id=_id;
 INSERT INTO public.jobsheet_time_logs (company_id,jobsheet_id,log_date,time_in,time_out,latitude_in,longitude_in,latitude_out,longitude_out,traveling_time_hours,technician_count,technician_initials,daily_work_description,daily_total_hours,sort_order)
 SELECT s.company_id,_id,x.log_date,x.time_in,x.time_out,x.latitude_in,x.longitude_in,x.latitude_out,x.longitude_out,coalesce(x.traveling_time_hours,0),greatest(1,coalesce(x.technician_count,1)),coalesce(x.technician_initials,'{}'),x.daily_work_description,coalesce(x.daily_total_hours,0),x.sort_order FROM jsonb_populate_recordset(NULL::public.jobsheet_time_logs,_logs) x;
 DELETE FROM public.jobsheet_parts WHERE jobsheet_id=_id;
 INSERT INTO public.jobsheet_parts(company_id,jobsheet_id,part_description,unit,quantity,time_acquiring_parts_hours,sort_order,log_sort_order)
 SELECT s.company_id,_id,x.part_description,x.unit,x.quantity,coalesce(x.time_acquiring_parts_hours,0),x.sort_order,x.log_sort_order FROM jsonb_populate_recordset(NULL::public.jobsheet_parts,_parts) x;
 RETURN stamp;
END $$;
GRANT EXECUTE ON FUNCTION public.save_sheet_snapshot(uuid,timestamptz,jsonb,jsonb,jsonb) TO authenticated;
CREATE FUNCTION public.sign_batch_sheet(_batch uuid,_sheet uuid,_name text,_card text,_signature text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE b public.signing_batches; s public.job_sheets; items jsonb;
BEGIN
 SELECT * INTO b FROM public.signing_batches WHERE id=_batch AND created_by=auth.uid() FOR UPDATE;
 IF NOT FOUND OR b.status<>'signing' THEN RAISE EXCEPTION 'Signing session unavailable'; END IF;
 IF NOT (_sheet=ANY(b.sheet_ids)) THEN RAISE EXCEPTION 'Sheet is outside this signing session'; END IF;
 IF _sheet=ANY(b.signed_ids) THEN RETURN; END IF;
 IF length(trim(_name))=0 OR length(trim(_card))=0 OR _signature NOT LIKE 'data:image/png;base64,%' OR length(_signature)>2000000 THEN RAISE EXCEPTION 'Client name, ID and signature are required'; END IF;
 SELECT * INTO s FROM public.job_sheets WHERE id=_sheet FOR UPDATE;
 IF NOT FOUND OR s.client_id<>b.client_id OR to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM')<>b.month OR s.status='completed' OR coalesce(s.signature_data,'')<>'' THEN RAISE EXCEPTION 'Sheet is no longer available for signing'; END IF;
 IF s.is_maintenance THEN
 SELECT t.items INTO items FROM public.checklist_templates t WHERE t.equipment_category=CASE s.asset_type WHEN 'Lift' THEN 'Elevator' WHEN 'Escalator' THEN 'Escalator' ELSE 'Custom' END LIMIT 1;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(items,'[]')) i WHERE coalesce(s.checklist_values->>i,'false')<>'true') THEN RAISE EXCEPTION 'Maintenance checklist must be completed before signing'; END IF;
 END IF;
 UPDATE public.job_sheets SET client_full_name=trim(_name),client_id_card_no=trim(_card),signature_data=_signature,status='completed',work_end_time=coalesce(work_end_time,now()) WHERE id=_sheet;
 UPDATE public.signing_batches SET signed_ids=array_append(signed_ids,_sheet) WHERE id=_batch;
END $$;
GRANT EXECUTE ON FUNCTION public.sign_batch_sheet(uuid,uuid,text,text,text) TO authenticated;