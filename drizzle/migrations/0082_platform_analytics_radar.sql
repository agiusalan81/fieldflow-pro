CREATE TABLE public.platform_usage_daily (subscription_id uuid NOT NULL REFERENCES public.platform_subscriptions(id), day date NOT NULL DEFAULT current_date, feature text NOT NULL, event_count integer NOT NULL DEFAULT 0, PRIMARY KEY(subscription_id,day,feature));
GRANT SELECT ON public.platform_usage_daily TO authenticated; GRANT ALL ON public.platform_usage_daily TO service_role;
ALTER TABLE public.platform_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_owner_read ON public.platform_usage_daily FOR SELECT TO authenticated USING(public.is_platform_owner());
CREATE TABLE public.platform_usage_totals (subscription_id uuid PRIMARY KEY REFERENCES public.platform_subscriptions(id), first_sign_in timestamptz, last_seen timestamptz, work_count integer NOT NULL DEFAULT 0);
GRANT SELECT ON public.platform_usage_totals TO authenticated; GRANT ALL ON public.platform_usage_totals TO service_role;
ALTER TABLE public.platform_usage_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY totals_owner_read ON public.platform_usage_totals FOR SELECT TO authenticated USING(public.is_platform_owner());
CREATE TABLE public.platform_outreach_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.platform_products(id), template_key text NOT NULL CHECK(template_key IN ('setup','value','unlock','feedback')), subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 200), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 3000), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(product_id,template_key));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.platform_outreach_templates TO authenticated; GRANT ALL ON public.platform_outreach_templates TO service_role;
ALTER TABLE public.platform_outreach_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_owner ON public.platform_outreach_templates FOR ALL TO authenticated USING(public.is_platform_owner()) WITH CHECK(public.is_platform_owner());
CREATE TABLE public.platform_engagement_actions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES public.platform_subscriptions(id), action_key text NOT NULL CHECK(action_key IN ('setup','value','unlock','feedback')), subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 200), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 3000), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','dismissed')), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.platform_engagement_actions TO authenticated; GRANT ALL ON public.platform_engagement_actions TO service_role;
ALTER TABLE public.platform_engagement_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY engagement_owner ON public.platform_engagement_actions FOR ALL TO authenticated USING(public.is_platform_owner()) WITH CHECK(public.is_platform_owner() AND created_by=auth.uid());
CREATE POLICY engagement_tenant_read ON public.platform_engagement_actions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.platform_subscriptions s WHERE s.id=subscription_id AND s.company_id=public.current_company_id()) AND public.member_is_active(auth.uid()));
CREATE TABLE public.platform_feedback (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES public.platform_subscriptions(id), submitted_by uuid NOT NULL, rating integer CHECK(rating BETWEEN 1 AND 5), category text NOT NULL CHECK(category IN ('setup','missing_feature','pricing','bug','other')), message text NOT NULL CHECK(length(message) BETWEEN 1 AND 2000), status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','resolved')), owner_notes text NOT NULL DEFAULT '' CHECK(length(owner_notes)<=2000), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,UPDATE ON public.platform_feedback TO authenticated; GRANT ALL ON public.platform_feedback TO service_role;
ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_owner ON public.platform_feedback FOR ALL TO authenticated USING(public.is_platform_owner()) WITH CHECK(public.is_platform_owner());
CREATE POLICY feedback_own_read ON public.platform_feedback FOR SELECT TO authenticated USING(submitted_by=auth.uid() AND public.member_is_active(auth.uid()));
CREATE OR REPLACE FUNCTION public.record_platform_usage(_feature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF _feature NOT IN ('sign_in','job_sheets','dispatch','daily_reports','inventory','contracts','estimates','technical_library','standby','team_chat','company_settings','subscription') THEN RAISE EXCEPTION 'Unsupported feature'; END IF;
 SELECT s.id INTO sid FROM public.platform_subscriptions s JOIN public.platform_products p ON p.id=s.product_id WHERE s.company_id=public.current_company_id() AND p.slug='fieldbridge' ORDER BY s.created_at DESC LIMIT 1;
 IF sid IS NULL THEN RETURN; END IF;
 INSERT INTO public.platform_usage_daily(subscription_id,day,feature,event_count) VALUES(sid,current_date,_feature,1) ON CONFLICT(subscription_id,day,feature) DO NOTHING;
 INSERT INTO public.platform_usage_totals(subscription_id,first_sign_in,last_seen) VALUES(sid,now(),now()) ON CONFLICT(subscription_id) DO UPDATE SET last_seen=now();
END $$;
REVOKE ALL ON FUNCTION public.record_platform_usage(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.record_platform_usage(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.capture_platform_work() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; feature_key text;
BEGIN
 SELECT s.id INTO sid FROM public.platform_subscriptions s JOIN public.platform_products p ON p.id=s.product_id WHERE s.company_id=NEW.company_id AND p.slug='fieldbridge' ORDER BY s.created_at DESC LIMIT 1;
 IF sid IS NULL THEN RETURN NEW; END IF;
 feature_key := CASE TG_TABLE_NAME WHEN 'job_sheets' THEN 'work_job_sheet' WHEN 'jobs' THEN 'work_dispatch' ELSE 'work_daily_report' END;
 INSERT INTO public.platform_usage_daily(subscription_id,day,feature,event_count) VALUES(sid,current_date,feature_key,1) ON CONFLICT(subscription_id,day,feature) DO UPDATE SET event_count=platform_usage_daily.event_count+1;
 INSERT INTO public.platform_usage_totals(subscription_id,work_count) VALUES(sid,1) ON CONFLICT(subscription_id) DO UPDATE SET work_count=platform_usage_totals.work_count+1;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_platform_work() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER analytics_sheet_created AFTER INSERT ON public.job_sheets FOR EACH ROW EXECUTE FUNCTION public.capture_platform_work();
CREATE TRIGGER analytics_job_created AFTER INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.capture_platform_work();
CREATE TRIGGER analytics_report_created AFTER INSERT ON public.daily_work_reports FOR EACH ROW EXECUTE FUNCTION public.capture_platform_work();
CREATE OR REPLACE FUNCTION public.submit_platform_feedback(_rating integer,_category text,_message text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.member_is_active(auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF _rating NOT BETWEEN 1 AND 5 OR _category NOT IN ('setup','missing_feature','pricing','bug','other') OR length(trim(_message)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid feedback'; END IF;
 SELECT s.id INTO sid FROM public.platform_subscriptions s JOIN public.platform_products p ON p.id=s.product_id WHERE s.company_id=public.current_company_id() AND p.slug='fieldbridge' ORDER BY s.created_at DESC LIMIT 1;
 IF sid IS NULL THEN RAISE EXCEPTION 'No product subscription'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
 IF EXISTS(SELECT 1 FROM public.platform_feedback WHERE submitted_by=auth.uid() AND created_at>now()-interval '5 minutes') THEN RAISE EXCEPTION 'Please wait five minutes before sending more feedback'; END IF;
 INSERT INTO public.platform_feedback(subscription_id,submitted_by,rating,category,message) VALUES(sid,auth.uid(),_rating,_category,trim(_message)) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.submit_platform_feedback(integer,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.submit_platform_feedback(integer,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.platform_analytics_summary(_product uuid,_days integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Platform-owner access required'; END IF;
 IF _days NOT IN (7,30,90) THEN RAISE EXCEPTION 'Invalid period'; END IF;
 SELECT jsonb_build_object('tenants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'company_id',s.company_id,'name',coalesce(nullif(s.tenant_name,''),c.name,s.external_tenant_id),'status',s.status,'created_at',s.created_at,'trial_ends_at',s.trial_ends_at,'first_sign_in',t.first_sign_in,'last_seen',t.last_seen,'work_count',coalesce(t.work_count,0),'active_days',(SELECT count(*) FROM public.platform_usage_daily d WHERE d.subscription_id=s.id AND d.feature='sign_in' AND d.day>=current_date-(_days-1)),'contact_email',coalesce(cs.company_email,''),'is_test',coalesce(cc.is_test,false))) FROM public.platform_subscriptions s LEFT JOIN public.companies c ON c.id=s.company_id LEFT JOIN public.company_settings cs ON cs.company_id=s.company_id LEFT JOIN public.platform_company_controls cc ON cc.company_id=s.company_id LEFT JOIN public.platform_usage_totals t ON t.subscription_id=s.id WHERE s.product_id=_product),'[]'::jsonb),'daily',coalesce((SELECT jsonb_agg(row_to_json(r)) FROM (SELECT d.day,d.feature,count(DISTINCT d.subscription_id) AS tenants,sum(d.event_count) AS events FROM public.platform_usage_daily d JOIN public.platform_subscriptions s ON s.id=d.subscription_id LEFT JOIN public.platform_company_controls cc ON cc.company_id=s.company_id WHERE s.product_id=_product AND d.day>=current_date-(_days-1) AND NOT coalesce(cc.is_test,false) GROUP BY d.day,d.feature ORDER BY d.day) r),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.platform_analytics_summary(uuid,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.platform_analytics_summary(uuid,integer) TO authenticated;
CREATE TRIGGER analytics_templates_audit AFTER INSERT OR UPDATE OR DELETE ON public.platform_outreach_templates FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();
CREATE TRIGGER analytics_actions_audit AFTER INSERT OR UPDATE ON public.platform_engagement_actions FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change();
COMMENT ON TABLE public.platform_usage_daily IS 'Coarse company-day feature counts only; no URLs, IPs, client data, GPS, payroll or sick leave. Tracking begins on deployment, not historical backfill.';