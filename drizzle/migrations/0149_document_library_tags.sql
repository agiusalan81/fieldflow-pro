ALTER TABLE public.document_masters DROP CONSTRAINT IF EXISTS document_masters_kind_check;
ALTER TABLE public.document_masters ADD CONSTRAINT document_masters_kind_present CHECK (length(trim(kind)) BETWEEN 1 AND 60);
ALTER TABLE public.document_masters ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT '';
ALTER TABLE public.document_masters ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'all';
ALTER TABLE public.document_masters ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.contract_types(id) ON DELETE SET NULL;
ALTER TABLE public.document_masters ADD CONSTRAINT document_masters_sector_check CHECK (sector IN ('all','residential','commercial','industrial'));
ALTER TABLE public.document_attachments ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS document_attachments_asset_idx ON public.document_attachments(asset_id);

CREATE OR REPLACE FUNCTION public.guard_document_master_tier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.tier_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contract_types WHERE id=NEW.tier_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Tier is outside this company'; END IF;
  NEW.kind := lower(trim(NEW.kind)); NEW.contract_type := trim(NEW.contract_type);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS document_masters_tier_guard ON public.document_masters;
CREATE TRIGGER document_masters_tier_guard BEFORE INSERT OR UPDATE ON public.document_masters FOR EACH ROW EXECUTE FUNCTION public.guard_document_master_tier();

CREATE OR REPLACE FUNCTION public.guard_document_attachment_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.document_masters WHERE id=NEW.master_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Document is outside this company'; END IF;
  IF NEW.site_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sites WHERE id=NEW.site_id AND client_id=NEW.client_id) THEN RAISE EXCEPTION 'Site does not belong to this client'; END IF;
  IF NEW.asset_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.assets a WHERE a.id=NEW.asset_id AND a.company_id=NEW.company_id AND (NEW.site_id IS NULL OR a.site_id=NEW.site_id)) THEN RAISE EXCEPTION 'Equipment does not belong to this site'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS document_attachments_scope_guard ON public.document_attachments;
CREATE TRIGGER document_attachments_scope_guard BEFORE INSERT OR UPDATE ON public.document_attachments FOR EACH ROW EXECUTE FUNCTION public.guard_document_attachment_scope();

CREATE OR REPLACE FUNCTION public.invite_client_contact(_client uuid, _contact uuid, _admin boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE scope jsonb:=public.client_workspace_scope(_client); c public.client_contacts; token text:=encode(extensions.gen_random_bytes(32),'hex');
  is_admin boolean:=coalesce((scope->>'admin')::boolean,false); is_office boolean:=coalesce((scope->>'office')::boolean,false); all_scope boolean:=coalesce((scope->>'all_sites')::boolean,false); want_admin boolean:=coalesce(_admin,false);
BEGIN
  IF NOT is_admin OR (want_admin AND NOT is_office) THEN RAISE EXCEPTION 'Only authorised administrators can invite clients'; END IF;
  IF NOT coalesce(public.company_module_access((scope->>'company')::uuid,'client_portal'),false) THEN RAISE EXCEPTION 'The client portal is not included in your plan'; END IF;
  SELECT * INTO c FROM public.client_contacts WHERE id=_contact AND client_id=_client AND company_id=(scope->>'company')::uuid;
  IF NOT FOUND OR coalesce(trim(c.email),'')='' THEN RAISE EXCEPTION 'Add an email address to this contact before inviting them'; END IF;
  IF NOT all_scope AND (coalesce(c.all_sites,false) OR NOT to_jsonb(coalesce(c.site_ids,'{}'::uuid[]))<@coalesce(scope->'site_ids','[]'::jsonb)) THEN RAISE EXCEPTION 'Contact outside your site authority'; END IF;
  INSERT INTO public.client_portal_invites(company_id,client_id,contact_id,email,access_role,all_sites,site_ids,token_hash,created_by) VALUES(c.company_id,c.client_id,c.id,lower(trim(c.email)),CASE WHEN want_admin THEN 'client_admin' ELSE 'contact' END,coalesce(c.all_sites,false),coalesce(c.site_ids,'{}'::uuid[]),encode(extensions.digest(token,'sha256'),'hex'),auth.uid());
  INSERT INTO public.client_portal_audit(company_id,client_id,actor_id,action,contact_id) VALUES(c.company_id,c.client_id,auth.uid(),'invitation_created',c.id);
  RETURN token;
END $$;