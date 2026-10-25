CREATE OR REPLACE FUNCTION public.guard_document_master()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
 IF TG_OP='DELETE' THEN IF coalesce(current_setting('app.force_master_delete', true),'')<>OLD.id::text AND (OLD.state<>'draft' OR EXISTS(SELECT 1 FROM public.document_attachments WHERE master_id=OLD.id) OR EXISTS(SELECT 1 FROM public.contract_types WHERE base_document_id=OLD.id OR checklist_document_id=OLD.id)) THEN RAISE EXCEPTION 'This document is in use or was published; archive it instead'; END IF; RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND OLD.state<>'draft' AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.items IS DISTINCT FROM OLD.items OR NEW.sections IS DISTINCT FROM OLD.sections OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.trade IS DISTINCT FROM OLD.trade OR NEW.field_specs IS DISTINCT FROM OLD.field_specs OR NEW.commercial IS DISTINCT FROM OLD.commercial OR NEW.extras IS DISTINCT FROM OLD.extras OR NEW.state='draft') THEN RAISE EXCEPTION 'Clone a published document before editing'; END IF;
 IF trim(NEW.name)='' THEN RAISE EXCEPTION 'Enter a document name'; END IF;
 IF NEW.source_document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_documents WHERE id=NEW.source_document_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Source is outside this company'; END IF;
 IF NEW.cloned_from IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.document_masters WHERE id=NEW.cloned_from AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Clone is outside this company'; END IF;
 IF NEW.state='active' AND ((NEW.kind='checklist' AND cardinality(NEW.items)=0) OR (NEW.kind<>'checklist' AND trim(NEW.body)='' AND jsonb_array_length(NEW.sections)=0)) THEN RAISE EXCEPTION 'Complete the document before publishing'; END IF;
 NEW.updated_at=now(); RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.delete_document_master(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _m public.document_masters; _clients text[]; _tiers text[];
BEGIN
 SELECT * INTO _m FROM public.document_masters WHERE id=_id AND company_id=public.current_company_id() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
 IF NOT public.has_company_role('admin'::user_role) OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Only office admins can delete documents'; END IF;
 SELECT coalesce(array_agg(DISTINCT n ORDER BY n), '{}') INTO _clients FROM (
   SELECT c.name n FROM public.document_attachments a JOIN public.clients c ON c.id=a.client_id WHERE a.master_id=_id
   UNION SELECT c.name FROM public.contract_types t JOIN public.maintenance_agreements ma ON ma.contract_type_id=t.id JOIN public.clients c ON c.id=ma.client_id WHERE t.base_document_id=_id OR t.checklist_document_id=_id) x;
 SELECT coalesce(array_agg(DISTINCT name ORDER BY name), '{}') INTO _tiers FROM public.contract_types WHERE base_document_id=_id OR checklist_document_id=_id;
 DELETE FROM public.document_attachments WHERE master_id=_id;
 UPDATE public.contract_types SET base_document_id=NULL WHERE base_document_id=_id;
 UPDATE public.contract_types SET checklist_document_id=NULL WHERE checklist_document_id=_id;
 PERFORM set_config('app.force_master_delete', _id::text, true);
 DELETE FROM public.document_masters WHERE id=_id;
 PERFORM set_config('app.force_master_delete', '', true);
 RETURN jsonb_build_object('name', _m.name, 'clients', to_jsonb(_clients), 'tiers', to_jsonb(_tiers));
END $$;
REVOKE ALL ON FUNCTION public.delete_document_master(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_document_master(uuid) TO authenticated;