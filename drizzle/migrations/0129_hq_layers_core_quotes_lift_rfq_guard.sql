CREATE OR REPLACE FUNCTION public.company_module_access(_company uuid, _module text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE sid uuid; state text;
BEGIN
 SELECT id,status INTO sid,state FROM public.platform_subscriptions WHERE company_id=_company AND product_id=public.company_app_product_id() LIMIT 1;
 IF NOT FOUND OR state='legacy' THEN RETURN true; END IF;
 RETURN public.platform_subscription_module_access(sid,CASE WHEN _module='customer_quotes' THEN 'core' ELSE _module END);
END $$;
DROP TRIGGER IF EXISTS lift_estimates_vertical_guard ON public.lift_estimates;
CREATE TRIGGER lift_estimates_vertical_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lift_estimates FOR EACH ROW EXECUTE FUNCTION public.guard_module_write_additional('lift_pack');
COMMENT ON FUNCTION public.company_module_access(uuid,text) IS 'Customer quoting inherits Core; tenant legacy, trial, invoice lapse and overrides remain delegated to the canonical subscription access helper.';