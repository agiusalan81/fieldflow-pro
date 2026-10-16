CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _company_name text := nullif(trim(NEW.raw_user_meta_data->>'company_name'), '');
  _full_name text := coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));
  _company_id uuid;
BEGIN
  -- Only self-service signups that name a company create a new tenant + admin.
  IF _company_name IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.companies(name) VALUES (left(_company_name, 200)) RETURNING id INTO _company_id;
  INSERT INTO public.users(id, company_id, full_name, email, role)
  VALUES (NEW.id, _company_id, left(_full_name, 200), NEW.email, 'admin');
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_company
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();