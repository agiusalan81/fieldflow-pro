BEGIN;
DO $$
DECLARE c uuid; s uuid; p uuid;
BEGIN
 SELECT id INTO p FROM public.platform_products WHERE slug='fieldbridge';
 INSERT INTO public.companies(name) VALUES('HQ module layer regression') RETURNING id INTO c;
 SELECT id INTO s FROM public.platform_subscriptions WHERE company_id=c AND product_id=p;
 IF public.company_module_access(c,'customer_quotes') IS DISTINCT FROM public.company_module_access(c,'core') THEN RAISE EXCEPTION 'Customer quotes must inherit Core in trial'; END IF;
 UPDATE public.platform_subscriptions SET status='active',plan_id=null,pack_ids='{}' WHERE id=s;
 IF NOT public.company_module_access(c,'customer_quotes') THEN RAISE EXCEPTION 'Core customer quotes must remain accessible without a lift pack'; END IF;
 INSERT INTO public.platform_overrides(subscription_id,module,enabled,starts_at,ends_at) VALUES(s,'lift_pack',false,now()-interval '1 day',now()+interval '1 day');
 IF public.company_module_access(c,'lift_pack') THEN RAISE EXCEPTION 'Disabled lift pack must be locked'; END IF;
 IF NOT public.company_module_access(c,'customer_quotes') THEN RAISE EXCEPTION 'Disabling lift pack must not disable customer quoting'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.lift_estimates'::regclass AND tgname='lift_estimates_vertical_guard' AND encode(tgargs,'escape') LIKE 'lift_pack%') THEN RAISE EXCEPTION 'Lift RFQ writes need the vertical guard'; END IF;
 UPDATE public.platform_subscriptions SET status='trial',trial_ends_at=now()-interval '1 day' WHERE id=s;
 IF public.company_module_access(c,'customer_quotes') THEN RAISE EXCEPTION 'Expired trial must block quote writes'; END IF;
 UPDATE public.platform_subscriptions SET status='legacy' WHERE id=s;
 IF NOT public.company_module_access(c,'lift_pack') THEN RAISE EXCEPTION 'Legacy lift access must survive'; END IF;
END $$;
ROLLBACK;