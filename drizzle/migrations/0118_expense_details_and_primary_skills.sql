ALTER TABLE public.expense_receipts ADD COLUMN expense_date date, ADD COLUMN amount numeric(12,2), ADD COLUMN currency text NOT NULL DEFAULT 'EUR';
ALTER TABLE public.expense_receipts ADD CONSTRAINT expense_amount_positive CHECK(amount IS NULL OR amount>0), ADD CONSTRAINT expense_currency_code CHECK(currency ~ '^[A-Z]{3}$');
ALTER TABLE public.company_settings ADD COLUMN field_sheet_history_months integer NOT NULL DEFAULT 12 CHECK(field_sheet_history_months IN(1,3,6,12));
ALTER TABLE public.member_skills ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX member_one_primary_skill ON public.member_skills(company_id,user_id) WHERE is_primary;
CREATE OR REPLACE FUNCTION public.set_member_primary_skill(_user uuid,_skill uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE co uuid:=public.current_company_id(); BEGIN
IF NOT public.is_company_manager() OR NOT public.member_is_active(auth.uid()) OR NOT public.company_module_access(co,'skills_dispatch') THEN RAISE EXCEPTION 'Skills management unavailable';END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(co::text||':primary:'||_user::text,0));
IF NOT EXISTS(SELECT 1 FROM public.member_skills m JOIN public.company_skills s ON s.id=m.skill_id WHERE m.company_id=co AND m.user_id=_user AND m.skill_id=_skill AND NOT s.archived) THEN RAISE EXCEPTION 'Choose an assigned active skill'; END IF;
UPDATE public.member_skills SET is_primary=false WHERE company_id=co AND user_id=_user AND is_primary;
UPDATE public.member_skills SET is_primary=true WHERE company_id=co AND user_id=_user AND skill_id=_skill;
END $$;
REVOKE ALL ON FUNCTION public.set_member_primary_skill(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.set_member_primary_skill(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.same_standby_primary_skill(_a uuid,_b uuid,_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.member_skills a JOIN public.member_skills b ON b.company_id=a.company_id AND b.skill_id=a.skill_id JOIN public.company_skills s ON s.id=a.skill_id WHERE a.company_id=_company AND a.user_id=_a AND b.user_id=_b AND a.is_primary AND b.is_primary AND NOT s.archived) $$;
REVOKE ALL ON FUNCTION public.same_standby_primary_skill(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.standby_swap_candidates() RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT r.user_id FROM public.user_roles r JOIN public.user_roles me ON me.user_id=auth.uid() AND me.company_id=r.company_id AND me.role=r.role WHERE r.company_id=public.current_company_id() AND r.user_id<>auth.uid() AND public.member_is_active(auth.uid()) AND public.member_is_active(r.user_id) AND public.company_module_access(r.company_id,'standby') AND public.company_module_access(r.company_id,'skills_dispatch') AND public.same_standby_primary_skill(auth.uid(),r.user_id,r.company_id) $$;
REVOKE ALL ON FUNCTION public.standby_swap_candidates() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.standby_swap_candidates() TO authenticated;