CREATE OR REPLACE FUNCTION public.save_sheet_snapshot(_id uuid, _expected timestamptz, _form jsonb, _logs jsonb, _parts jsonb) RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s public.job_sheets; v public.job_sheets; stamp timestamptz;
BEGIN
 SELECT * INTO s FROM public.job_sheets WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job sheet unavailable'; END IF;
 IF s.status='completed' THEN RAISE EXCEPTION 'Completed sheet is read-only'; END IF;
 IF s.updated_at IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'CONFLICT: this sheet changed on another device. Review before syncing'; END IF;
 v:=jsonb_populate_record(s,_form);
 UPDATE public.job_sheets SET client_id=v.client_id,site_id=v.site_id,asset_id=v.asset_id,asset_type=v.asset_type,asset_type_other=v.asset_type_other,lift_model=v.lift_model,serial_number=v.serial_number,requires_admin_approval=v.requires_admin_approval,is_tech_assistance=v.is_tech_assistance,is_maintenance=v.is_maintenance,is_installation=v.is_installation,job_type_other=v.job_type_other,maintenance_agreement_type=v.maintenance_agreement_type,reported_fault=v.reported_fault,repairs_performed=v.repairs_performed,pending_works_future_jobs=v.pending_works_future_jobs,internal_comments_admin_only=v.internal_comments_admin_only,technician_name=v.technician_name,client_full_name=v.client_full_name,client_id_card_no=v.client_id_card_no,signature_data=v.signature_data,special_notes=v.special_notes,special_notes_in_pdf=v.special_notes_in_pdf,special_notes_in_email=v.special_notes_in_email,checklist_values=v.checklist_values,maintenance_notes=v.maintenance_notes WHERE id=_id RETURNING updated_at INTO stamp;
 DELETE FROM public.jobsheet_time_logs WHERE jobsheet_id=_id;
 INSERT INTO public.jobsheet_time_logs (company_id,jobsheet_id,log_date,time_in,time_out,latitude_in,longitude_in,latitude_out,longitude_out,traveling_time_hours,technician_count,technician_initials,daily_work_description,daily_total_hours,sort_order)
 SELECT s.company_id,_id,x.log_date,x.time_in,x.time_out,x.latitude_in,x.longitude_in,x.latitude_out,x.longitude_out,coalesce(x.traveling_time_hours,0),greatest(1,coalesce(x.technician_count,1)),coalesce(x.technician_initials,'{}'),x.daily_work_description,coalesce(x.daily_total_hours,0),x.sort_order FROM jsonb_populate_recordset(NULL::public.jobsheet_time_logs,_logs) x;
 DELETE FROM public.jobsheet_parts WHERE jobsheet_id=_id;
 INSERT INTO public.jobsheet_parts(company_id,jobsheet_id,part_description,unit,quantity,time_acquiring_parts_hours,sort_order,log_sort_order)
 SELECT s.company_id,_id,x.part_description,x.unit,x.quantity,coalesce(x.time_acquiring_parts_hours,0),x.sort_order,x.log_sort_order FROM jsonb_populate_recordset(NULL::public.jobsheet_parts,_parts) x;
 RETURN stamp;
END $$;