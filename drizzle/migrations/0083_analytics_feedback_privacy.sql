DROP POLICY feedback_own_read ON public.platform_feedback;
DROP POLICY engagement_tenant_read ON public.platform_engagement_actions;
CREATE POLICY engagement_tenant_read ON public.platform_engagement_actions FOR SELECT TO authenticated USING(action_key='feedback' AND status='open' AND EXISTS(SELECT 1 FROM public.platform_subscriptions s WHERE s.id=subscription_id AND s.company_id=public.current_company_id()) AND public.member_is_active(auth.uid()));
CREATE OR REPLACE FUNCTION public.guard_outreach_tokens() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE token text;
BEGIN
 FOR token IN SELECT m[1] FROM regexp_matches(NEW.subject || NEW.body,'\{\{([a-z_]+)\}\}','g') AS m LOOP
  IF token NOT IN ('product_name','product_domain','contact_name','company_name','support_email','founder_name','trial_days_left') THEN RAISE EXCEPTION 'Unsupported outreach token'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_outreach_tokens BEFORE INSERT OR UPDATE ON public.platform_outreach_templates FOR EACH ROW EXECUTE FUNCTION public.guard_outreach_tokens();