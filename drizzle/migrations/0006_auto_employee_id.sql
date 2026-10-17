CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _parts text[];
  _first text;
  _last text;
  _prefix text;
  _n int;
BEGIN
  IF NEW.employee_id IS NOT NULL AND btrim(NEW.employee_id) <> '' THEN
    RETURN NEW;
  END IF;
  _parts := regexp_split_to_array(btrim(NEW.full_name), '\s+');
  _first := upper(substr(regexp_replace(_parts[1], '[^A-Za-z]', '', 'g'), 1, 3));
  _last := upper(substr(regexp_replace(_parts[array_length(_parts, 1)], '[^A-Za-z]', '', 'g'), 1, 3));
  _prefix := _first || _last;
  SELECT count(*) + 1 INTO _n
  FROM public.users
  WHERE company_id = NEW.company_id AND employee_id LIKE _prefix || '%';
  NEW.employee_id := _prefix || lpad(_n::text, 2, '0');
  RETURN NEW;
END $$;

CREATE TRIGGER users_generate_employee_id
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.generate_employee_id();

WITH numbered AS (
  SELECT id,
    upper(substr(regexp_replace((regexp_split_to_array(btrim(full_name), '\s+'))[1], '[^A-Za-z]', '', 'g'), 1, 3)) ||
    upper(substr(regexp_replace((regexp_split_to_array(btrim(full_name), '\s+'))[array_length(regexp_split_to_array(btrim(full_name), '\s+'), 1)], '[^A-Za-z]', '', 'g'), 1, 3)) AS prefix,
    row_number() OVER (
      PARTITION BY company_id,
        upper(substr(regexp_replace((regexp_split_to_array(btrim(full_name), '\s+'))[1], '[^A-Za-z]', '', 'g'), 1, 3)) ||
        upper(substr(regexp_replace((regexp_split_to_array(btrim(full_name), '\s+'))[array_length(regexp_split_to_array(btrim(full_name), '\s+'), 1)], '[^A-Za-z]', '', 'g'), 1, 3))
      ORDER BY created_at
    ) AS rn
  FROM public.users
  WHERE employee_id IS NULL OR btrim(employee_id) = ''
)
UPDATE public.users u
SET employee_id = n.prefix || lpad(n.rn::text, 2, '0')
FROM numbered n
WHERE u.id = n.id;