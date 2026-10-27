-- Written confirmation of an office-recorded acceptance belongs to Core quoting.
-- Portal access and approval of other issued quotes retain their existing pack gate.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.customer_quote_action(uuid,text,jsonb)'::regprocedure) INTO definition;
 IF position('IF coalesce((_data->>''approval'')::boolean,false) AND NOT public.company_module_access(c,''client_portal'') THEN' IN definition)=0 THEN
  RAISE EXCEPTION 'Quote link guard changed; review before applying';
 END IF;
 definition:=replace(definition,
  'IF coalesce((_data->>''approval'')::boolean,false) AND NOT public.company_module_access(c,''client_portal'') THEN',
  'IF coalesce((_data->>''approval'')::boolean,false) AND NOT (public.company_module_access(c,''client_portal'') OR (q.status=''awaiting_confirmation'' AND public.company_module_access(c,''core''))) THEN');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.decide_customer_quote(text,text,text,text)'::regprocedure) INTO definition;
 IF position('OR NOT public.company_module_access(q.company_id,''client_portal'') THEN' IN definition)=0 THEN
  RAISE EXCEPTION 'Customer decision guard changed; review before applying';
 END IF;
 definition:=replace(definition,
  'OR NOT public.company_module_access(q.company_id,''client_portal'') THEN',
  'OR NOT (public.company_module_access(q.company_id,''client_portal'') OR (q.status=''awaiting_confirmation'' AND public.company_module_access(q.company_id,''core''))) THEN');
 EXECUTE definition;
END $migration$;