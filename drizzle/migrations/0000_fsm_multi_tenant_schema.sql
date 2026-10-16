-- ENUMS
CREATE TYPE public.user_role AS ENUM ('admin','technician','supervisor');
CREATE TYPE public.custom_field_target AS ENUM ('asset','job_sheet','client');
CREATE TYPE public.custom_field_type AS ENUM ('text','number','dropdown','date','checkbox');
CREATE TYPE public.job_status AS ENUM ('pending','in_transit','in_progress','completed');
CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected');

-- 1. companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. users (id = auth user id)
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'technician',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);
CREATE INDEX ON public.users(company_id);

-- Helper functions (security definer avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_role public.user_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_company_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','supervisor'))
$$;

-- 3. clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  billing_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.clients(company_id);

-- 4. client_contacts
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  role_title text,
  email text,
  phone text,
  is_primary_contact boolean NOT NULL DEFAULT false
);
CREATE INDEX ON public.client_contacts(company_id);
CREATE INDEX ON public.client_contacts(client_id);

-- 5. assets
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_number text NOT NULL,
  asset_category text NOT NULL,
  location_details text,
  custom_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (company_id, reference_number)
);
CREATE INDEX ON public.assets(company_id);
CREATE INDEX ON public.assets(client_id);
CREATE INDEX ON public.assets USING gin (custom_attributes);

-- 6. lookup_options
CREATE TABLE public.lookup_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_type text,
  category text NOT NULL,
  label_value text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  usage_count integer NOT NULL DEFAULT 0,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT lookup_scope CHECK ((is_global AND company_id IS NULL) OR (NOT is_global AND company_id IS NOT NULL))
);
CREATE INDEX ON public.lookup_options(company_id);
CREATE INDEX ON public.lookup_options(category);

-- 7. custom_field_definitions
CREATE TABLE public.custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  target_entity public.custom_field_target NOT NULL,
  field_label text NOT NULL,
  field_type public.custom_field_type NOT NULL,
  options_list jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options_list) = 'array')
);
CREATE INDEX ON public.custom_field_definitions(company_id, target_entity);

-- 8. job_sheets
CREATE TABLE public.job_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  assigned_technician_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  travel_start_time timestamptz,
  work_start_time timestamptz,
  work_end_time timestamptz,
  is_overtime boolean NOT NULL DEFAULT false,
  overtime_rate numeric(10,2),
  custom_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.job_sheets(company_id);
CREATE INDEX ON public.job_sheets(assigned_technician_id);
CREATE INDEX ON public.job_sheets(status);

-- 9. inventory_items
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  part_name text NOT NULL,
  sku text,
  min_stock_level integer NOT NULL DEFAULT 0,
  current_stock integer NOT NULL DEFAULT 0,
  requires_approval boolean NOT NULL DEFAULT false,
  UNIQUE (company_id, sku)
);
CREATE INDEX ON public.inventory_items(company_id);

-- 10. internal_messages
CREATE TABLE public.internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  job_sheet_id uuid REFERENCES public.job_sheets(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.internal_messages(company_id);
CREATE INDEX ON public.internal_messages(job_sheet_id);

-- 11. leave_requests
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.leave_status NOT NULL DEFAULT 'pending',
  CHECK (end_date >= start_date)
);
CREATE INDEX ON public.leave_requests(company_id);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.companies, public.users, public.clients, public.client_contacts, public.assets,
  public.lookup_options, public.custom_field_definitions, public.job_sheets,
  public.inventory_items, public.internal_messages, public.leave_requests
TO authenticated;
GRANT ALL ON
  public.companies, public.users, public.clients, public.client_contacts, public.assets,
  public.lookup_options, public.custom_field_definitions, public.job_sheets,
  public.inventory_items, public.internal_messages, public.leave_requests
TO service_role;

-- ENABLE RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookup_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- companies
CREATE POLICY "Members view own company" ON public.companies FOR SELECT TO authenticated
  USING (id = public.current_company_id());
CREATE POLICY "Admins update own company" ON public.companies FOR UPDATE TO authenticated
  USING (id = public.current_company_id() AND public.has_company_role('admin'))
  WITH CHECK (id = public.current_company_id());

-- users
CREATE POLICY "Members view company users" ON public.users FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "Admins insert company users" ON public.users FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.has_company_role('admin'));
CREATE POLICY "Admins update company users" ON public.users FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_company_role('admin'))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Admins delete company users" ON public.users FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_company_role('admin'));

-- Block non-admins from changing role/company (privilege escalation guard)
CREATE OR REPLACE FUNCTION public.guard_user_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.company_id IS DISTINCT FROM OLD.company_id)
     AND NOT public.has_company_role('admin') THEN
    RAISE EXCEPTION 'Only admins can change role or company';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_guard_privileges BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_privileges();

-- Generic company-scoped tables: all members read; managers write
CREATE POLICY "Company read" ON public.clients FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Company insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Company update" ON public.clients FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager()) WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Company delete" ON public.clients FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

CREATE POLICY "Company read" ON public.client_contacts FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Company insert" ON public.client_contacts FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Company update" ON public.client_contacts FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager()) WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Company delete" ON public.client_contacts FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

-- assets: technicians may update (e.g. custom attributes on site)
CREATE POLICY "Company read" ON public.assets FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Company insert" ON public.assets FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Company update" ON public.assets FOR UPDATE TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Company delete" ON public.assets FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

-- lookup_options: globals readable by all signed-in users; company options scoped
CREATE POLICY "Read global or company" ON public.lookup_options FOR SELECT TO authenticated
  USING (is_global OR company_id = public.current_company_id());
CREATE POLICY "Insert company options" ON public.lookup_options FOR INSERT TO authenticated
  WITH CHECK (NOT is_global AND company_id = public.current_company_id() AND created_by_user_id = auth.uid());
CREATE POLICY "Update company options" ON public.lookup_options FOR UPDATE TO authenticated
  USING (NOT is_global AND company_id = public.current_company_id())
  WITH CHECK (NOT is_global AND company_id = public.current_company_id());
CREATE POLICY "Delete company options" ON public.lookup_options FOR DELETE TO authenticated
  USING (NOT is_global AND company_id = public.current_company_id() AND public.is_company_manager());

CREATE POLICY "Company read" ON public.custom_field_definitions FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Admin insert" ON public.custom_field_definitions FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.has_company_role('admin'));
CREATE POLICY "Admin update" ON public.custom_field_definitions FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.has_company_role('admin')) WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Admin delete" ON public.custom_field_definitions FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.has_company_role('admin'));

-- job_sheets: managers full access; technicians see & update their assigned jobs
CREATE POLICY "Company read" ON public.job_sheets FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (public.is_company_manager() OR assigned_technician_id = auth.uid()));
CREATE POLICY "Manager insert" ON public.job_sheets FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Manager or assignee update" ON public.job_sheets FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (public.is_company_manager() OR assigned_technician_id = auth.uid()))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Manager delete" ON public.job_sheets FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager());

CREATE POLICY "Company read" ON public.inventory_items FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Company insert" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_manager());
CREATE POLICY "Company update" ON public.inventory_items FOR UPDATE TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Company delete" ON public.inventory_items FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_manager());

-- internal_messages: sender/receiver, or job thread visible to company members on that job
CREATE POLICY "Read own or job thread" ON public.internal_messages FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (
    sender_id = auth.uid() OR receiver_id = auth.uid()
    OR (job_sheet_id IS NOT NULL AND receiver_id IS NULL)
  ));
CREATE POLICY "Send as self" ON public.internal_messages FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND sender_id = auth.uid());
CREATE POLICY "Sender delete" ON public.internal_messages FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND sender_id = auth.uid());

-- leave_requests: users manage own; managers approve
CREATE POLICY "Read own or manager" ON public.leave_requests FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_manager()));
CREATE POLICY "Request own leave" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Manager update" ON public.leave_requests FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_manager())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Delete own pending" ON public.leave_requests FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid() AND status = 'pending');
