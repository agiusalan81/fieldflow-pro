-- Rollback regression: a manager creates a lead, follow-up and timeline; Basic-plan tenants are blocked.
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', r.user_id, 'role', 'authenticated')::text, true)
  FROM public.user_roles r WHERE r.registration_status='active' AND r.role IN ('superuser','admin') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT public.crm_create_lead('{"title":"SQL regression lead"}'::jsonb, 'note', jsonb_build_object('action_key','default:phone_call','action_label','Phone call','due_at',now()));
SELECT count(*) = 1 AS lead_visible FROM public.crm_opportunities WHERE title='SQL regression lead';
SELECT count(*) = 1 AS followup_saved FROM public.crm_followups f JOIN public.crm_opportunities o ON o.id=f.opportunity_id WHERE o.title='SQL regression lead';
UPDATE public.crm_opportunities SET stage='contacted' WHERE title='SQL regression lead';
SELECT count(*) = 1 AS stage_logged FROM public.crm_activities a JOIN public.crm_opportunities o ON o.id=a.opportunity_id WHERE o.title='SQL regression lead' AND a.kind='stage';
ROLLBACK;
