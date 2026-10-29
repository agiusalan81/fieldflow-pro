ALTER TABLE public.jobs ADD COLUMN claim_incentive_override boolean NOT NULL DEFAULT false;
DO $$ DECLARE f text; BEGIN
f=pg_get_functiondef('public.guard_claim_incentive()'::regprocedure);f=replace(f,'IF NEW.claim_incentive_cents=0 THEN','IF NOT NEW.claim_incentive_override THEN');EXECUTE f;
f=pg_get_functiondef('public.dispatch_pending_work(uuid,text,jsonb)'::regprocedure);f=replace(f,'UPDATE public.jobs SET scheduled_date=day,','UPDATE public.jobs SET claim_incentive_cents=coalesce((_dispatch->>''claim_incentive_cents'')::integer,claim_incentive_cents), claim_incentive_override=(_dispatch->>''claim_incentive_cents'') IS NOT NULL, scheduled_date=day,');EXECUTE f;
f=pg_get_functiondef('public.pending_bell_push()'::regprocedure);f=replace(f,'FROM events e WHERE NOT EXISTS','FROM events e WHERE EXISTS(SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id=e.user_id) AND NOT EXISTS');EXECUTE f;
END $$;