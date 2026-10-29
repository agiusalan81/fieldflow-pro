ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS tool_checkout_mode text NOT NULL DEFAULT 'managed' CHECK (tool_checkout_mode IN ('managed','self_service')),
  ADD COLUMN IF NOT EXISTS parts_control_mode text NOT NULL DEFAULT 'managed' CHECK (parts_control_mode IN ('managed','self_service'));

CREATE TABLE public.company_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  tag text NOT NULL,
  name text NOT NULL,
  model text,
  serial_number text,
  category text NOT NULL DEFAULT 'General',
  default_location text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','checked_out','in_maintenance','decommissioned')),
  inspection_due date,
  notes text,
  holder_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, tag)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_tools TO authenticated;
GRANT ALL ON public.company_tools TO service_role;
ALTER TABLE public.company_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tools read" ON public.company_tools FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "tools insert" ON public.company_tools FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "tools update" ON public.company_tools FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager()) WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "tools delete" ON public.company_tools FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

CREATE TABLE public.tool_custody_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.company_tools(id) ON DELETE CASCADE,
  holder_id uuid NOT NULL,
  issued_by uuid NOT NULL,
  destination text,
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  expected_return date,
  returned_at timestamptz,
  received_by uuid,
  return_condition text CHECK (return_condition IN ('good','needs_maintenance')),
  return_notes text
);
CREATE INDEX ON public.tool_custody_logs (tool_id, checked_out_at DESC);
GRANT SELECT ON public.tool_custody_logs TO authenticated;
GRANT ALL ON public.tool_custody_logs TO service_role;
ALTER TABLE public.tool_custody_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custody read" ON public.tool_custody_logs FOR SELECT TO authenticated USING (company_id = public.current_company_id());

CREATE OR REPLACE FUNCTION public.tool_sign_out(_tool uuid, _holder uuid, _destination text, _expected date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid := public.current_company_id(); t public.company_tools; mode text;
BEGIN
  IF c IS NULL THEN RAISE EXCEPTION 'Not an active member'; END IF;
  SELECT * INTO t FROM public.company_tools WHERE id=_tool AND company_id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tool not found'; END IF;
  IF t.status <> 'available' THEN RAISE EXCEPTION 'Tool is not available'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_holder AND company_id=c AND registration_status='active') THEN RAISE EXCEPTION 'Holder is not an active team member'; END IF;
  SELECT coalesce(tool_checkout_mode,'managed') INTO mode FROM public.company_settings WHERE company_id=c;
  IF NOT public.is_company_manager() THEN
    IF coalesce(mode,'managed') <> 'self_service' THEN RAISE EXCEPTION 'Only office or supervisors can sign tools out'; END IF;
    IF _holder <> auth.uid() THEN RAISE EXCEPTION 'You can only sign tools out to yourself'; END IF;
  END IF;
  INSERT INTO public.tool_custody_logs(company_id,tool_id,holder_id,issued_by,destination,expected_return)
  VALUES (c,_tool,_holder,auth.uid(),nullif(trim(_destination),''),_expected);
  UPDATE public.company_tools SET status='checked_out', holder_id=_holder WHERE id=_tool;
END $$;

CREATE OR REPLACE FUNCTION public.tool_sign_in(_tool uuid, _condition text, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid := public.current_company_id(); t public.company_tools; mode text;
BEGIN
  IF _condition NOT IN ('good','needs_maintenance') THEN RAISE EXCEPTION 'Invalid condition'; END IF;
  SELECT * INTO t FROM public.company_tools WHERE id=_tool AND company_id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tool not found'; END IF;
  IF t.status <> 'checked_out' THEN RAISE EXCEPTION 'Tool is not signed out'; END IF;
  SELECT coalesce(tool_checkout_mode,'managed') INTO mode FROM public.company_settings WHERE company_id=c;
  IF NOT public.is_company_manager() AND (coalesce(mode,'managed') <> 'self_service' OR t.holder_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Only office or supervisors can sign this tool in';
  END IF;
  UPDATE public.tool_custody_logs SET returned_at=now(), received_by=auth.uid(), return_condition=_condition, return_notes=nullif(trim(_notes),'')
   WHERE tool_id=_tool AND returned_at IS NULL;
  UPDATE public.company_tools SET status = CASE WHEN _condition='good' THEN 'available' ELSE 'in_maintenance' END, holder_id=NULL WHERE id=_tool;
END $$;
REVOKE ALL ON FUNCTION public.tool_sign_out(uuid,uuid,text,date), public.tool_sign_in(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tool_sign_out(uuid,uuid,text,date), public.tool_sign_in(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_inventory_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mode text;
BEGIN
  IF public.is_company_manager() OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT parts_control_mode INTO mode FROM public.company_settings WHERE company_id=NEW.company_id;
  IF coalesce(mode,'managed') <> 'self_service' THEN RAISE EXCEPTION 'Only office or supervisors can adjust stock'; END IF;
  IF NEW.part_name IS DISTINCT FROM OLD.part_name OR NEW.sku IS DISTINCT FROM OLD.sku OR NEW.min_stock_level IS DISTINCT FROM OLD.min_stock_level OR NEW.requires_approval IS DISTINCT FROM OLD.requires_approval OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Technicians can only adjust stock quantities';
  END IF;
  IF OLD.requires_approval THEN RAISE EXCEPTION 'This part needs office approval to issue'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS inventory_stock_guard ON public.inventory_items;
CREATE TRIGGER inventory_stock_guard BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_stock();