CREATE TYPE public.app_role AS ENUM ('superuser','admin','supervisor','technician');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.user_roles(user_id, company_id, role)
SELECT u.id, u.company_id, CASE u.role WHEN 'admin' THEN 'superuser'::public.app_role WHEN 'supervisor' THEN 'supervisor'::public.app_role ELSE 'technician'::public.app_role END
FROM public.users u WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id)
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
$$;

-- Existing policies call these; they now read the separate roles table.
CREATE OR REPLACE FUNCTION public.has_company_role(_role public.user_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (
    role::text = _role::text OR (_role = 'admin' AND role = 'superuser')))
$$;

CREATE OR REPLACE FUNCTION public.is_company_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('superuser','admin','supervisor'))
$$;

CREATE POLICY "roles readable in company" ON public.user_roles FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "roles managed by superuser or admin" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'superuser') OR (public.has_role(auth.uid(),'admin') AND role <> 'superuser')));
CREATE POLICY "roles updated by superuser or admin" ON public.user_roles FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND user_id <> auth.uid() AND (public.has_role(auth.uid(),'superuser') OR (public.has_role(auth.uid(),'admin') AND role <> 'superuser')))
  WITH CHECK (company_id = public.current_company_id() AND (public.has_role(auth.uid(),'superuser') OR (public.has_role(auth.uid(),'admin') AND role <> 'superuser')));

-- Keep legacy users.role column mirrored (display only, not used for access).
CREATE OR REPLACE FUNCTION public.sync_legacy_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users SET role = (CASE WHEN NEW.role IN ('superuser','admin') THEN 'admin' ELSE NEW.role::text END)::public.user_role
  WHERE id = NEW.user_id;
  RETURN NEW;
END $$;
CREATE TRIGGER user_roles_sync_legacy AFTER INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_role();

CREATE OR REPLACE FUNCTION public.guard_user_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 1 AND NOT public.has_company_role('admin') AND (
       NEW.role IS DISTINCT FROM OLD.role OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.full_name IS DISTINCT FROM OLD.full_name OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.language_preference IS DISTINCT FROM OLD.language_preference OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.technician_initials IS DISTINCT FROM OLD.technician_initials OR NEW.signature_on_file IS DISTINCT FROM OLD.signature_on_file) THEN
    RAISE EXCEPTION 'Only admins can change these profile details';
  END IF;
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 1 AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Change roles from Team settings';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON COLUMN public.users.role IS 'DEPRECATED: display mirror only; roles live in public.user_roles';

-- Invites
CREATE TABLE public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  role public.app_role NOT NULL DEFAULT 'technician',
  email text,
  full_name text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites read by managers" ON public.company_invites FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "invites created by managers" ON public.company_invites FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND (
    public.has_role(auth.uid(),'superuser')
    OR (public.has_role(auth.uid(),'admin') AND role <> 'superuser')
    OR (public.has_role(auth.uid(),'supervisor') AND role IN ('technician','supervisor'))));
CREATE POLICY "invites revoked by managers" ON public.company_invites FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager() AND used_at IS NULL);

CREATE OR REPLACE FUNCTION public.get_invite(_token text)
RETURNS TABLE(company_name text, role public.app_role, email text, full_name text, valid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.name, i.role, i.email, i.full_name, (i.used_at IS NULL AND i.expires_at > now())
  FROM public.company_invites i JOIN public.companies c ON c.id = i.company_id WHERE i.token = _token
$$;
GRANT EXECUTE ON FUNCTION public.get_invite(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _company_name text := nullif(trim(NEW.raw_user_meta_data->>'company_name'), '');
  _token text := nullif(trim(NEW.raw_user_meta_data->>'invite_token'), '');
  _full_name text := coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));
  _company_id uuid;
  _inv public.company_invites;
BEGIN
  IF _token IS NOT NULL THEN
    SELECT * INTO _inv FROM public.company_invites WHERE token = _token AND used_at IS NULL AND expires_at > now() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'This invite link is invalid or has expired'; END IF;
    INSERT INTO public.users(id, company_id, full_name, email, role)
    VALUES (NEW.id, _inv.company_id, left(_full_name, 200), NEW.email,
      (CASE WHEN _inv.role IN ('superuser','admin') THEN 'admin' ELSE _inv.role::text END)::public.user_role);
    INSERT INTO public.user_roles(user_id, company_id, role) VALUES (NEW.id, _inv.company_id, _inv.role);
    UPDATE public.company_invites SET used_at = now(), used_by = NEW.id WHERE id = _inv.id;
    RETURN NEW;
  END IF;
  IF _company_name IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.companies(name) VALUES (left(_company_name, 200)) RETURNING id INTO _company_id;
  INSERT INTO public.users(id, company_id, full_name, email, role)
  VALUES (NEW.id, _company_id, left(_full_name, 200), NEW.email, 'admin');
  INSERT INTO public.user_roles(user_id, company_id, role) VALUES (NEW.id, _company_id, 'superuser');
  RETURN NEW;
END $$;

-- Module permissions
CREATE TABLE public.role_permissions (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  module text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (company_id, role, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perms readable in company" ON public.role_permissions FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "perms insert superuser" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'superuser'));
CREATE POLICY "perms update superuser" ON public.role_permissions FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'superuser'));
CREATE POLICY "perms delete superuser" ON public.role_permissions FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'superuser'));

-- Company operating hours & overtime rules
CREATE TABLE public.company_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  work_days int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  work_start time NOT NULL DEFAULT '07:30',
  work_end time NOT NULL DEFAULT '16:30',
  after_hours_rate numeric NOT NULL DEFAULT 1.5,
  saturday_rate numeric NOT NULL DEFAULT 1.5,
  sunday_rate numeric NOT NULL DEFAULT 2.0,
  holiday_rate numeric NOT NULL DEFAULT 2.0,
  public_holidays date[] NOT NULL DEFAULT '{}',
  renewal_notice_days int NOT NULL DEFAULT 30,
  industry text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.company_settings FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "settings insert admin" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.has_company_role('admin'));
CREATE POLICY "settings update admin" ON public.company_settings FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.has_company_role('admin'));

-- Contracts & checklists
CREATE TABLE public.contract_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  equipment_category text NOT NULL DEFAULT 'Elevator',
  tier text,
  visits_per_year int NOT NULL DEFAULT 12,
  annual_price numeric NOT NULL DEFAULT 0,
  labour_discount_pct numeric NOT NULL DEFAULT 0,
  parts_discount_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipment_category text NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.maintenance_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  contract_type_id uuid REFERENCES public.contract_types(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  annual_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  price_confirmed_at timestamptz,
  renewal_sent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_types, public.checklist_templates, public.maintenance_agreements TO authenticated;
GRANT ALL ON public.contract_types, public.checklist_templates, public.maintenance_agreements TO service_role;
ALTER TABLE public.contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct read managers" ON public.contract_types FOR SELECT TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "ct write admin" ON public.contract_types FOR ALL TO authenticated USING (company_id = public.current_company_id() AND public.has_company_role('admin')) WITH CHECK (company_id = public.current_company_id() AND public.has_company_role('admin'));
CREATE POLICY "cl read company" ON public.checklist_templates FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "cl write admin" ON public.checklist_templates FOR ALL TO authenticated USING (company_id = public.current_company_id() AND public.has_company_role('admin')) WITH CHECK (company_id = public.current_company_id() AND public.has_company_role('admin'));
CREATE POLICY "ma read managers" ON public.maintenance_agreements FOR SELECT TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "ma write admin" ON public.maintenance_agreements FOR ALL TO authenticated USING (company_id = public.current_company_id() AND public.has_company_role('admin')) WITH CHECK (company_id = public.current_company_id() AND public.has_company_role('admin'));

-- Lift estimates & supplier quote requests
CREATE TABLE public.lift_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  specs text,
  supplier_name text,
  supplier_email text,
  status text NOT NULL DEFAULT 'draft',
  quoted_amount numeric,
  events jsonb NOT NULL DEFAULT '[]',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lift_estimates TO authenticated;
GRANT ALL ON public.lift_estimates TO service_role;
ALTER TABLE public.lift_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "est managers" ON public.lift_estimates FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE TRIGGER lift_estimates_touch BEFORE UPDATE ON public.lift_estimates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.job_sheets ADD COLUMN checklist_values jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.job_sheets ADD COLUMN pending_status text NOT NULL DEFAULT 'open';
ALTER TABLE public.job_sheets ADD COLUMN pending_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;
