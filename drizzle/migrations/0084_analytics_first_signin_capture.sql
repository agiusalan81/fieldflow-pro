CREATE OR REPLACE FUNCTION public.record_platform_usage(_feature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF _feature NOT IN ('sign_in','job_sheets','dispatch','daily_reports','inventory','contracts','estimates','technical_library','standby','team_chat','company_settings','subscription') THEN RAISE EXCEPTION 'Unsupported feature'; END IF;
 SELECT s.id INTO sid FROM public.platform_subscriptions s JOIN public.platform_products p ON p.id=s.product_id WHERE s.company_id=public.current_company_id() AND p.slug='fieldbridge' ORDER BY s.created_at DESC LIMIT 1;
 IF sid IS NULL THEN RETURN; END IF;
 INSERT INTO public.platform_usage_daily(subscription_id,day,feature,event_count) VALUES(sid,current_date,_feature,1) ON CONFLICT(subscription_id,day,feature) DO NOTHING;
 INSERT INTO public.platform_usage_totals(subscription_id,first_sign_in,last_seen) VALUES(sid,now(),now()) ON CONFLICT(subscription_id) DO UPDATE SET first_sign_in=coalesce(platform_usage_totals.first_sign_in,now()),last_seen=now();
END $$;
REVOKE ALL ON FUNCTION public.record_platform_usage(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.record_platform_usage(text) TO authenticated;