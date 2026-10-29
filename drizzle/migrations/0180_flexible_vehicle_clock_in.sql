ALTER TABLE public.company_settings ADD COLUMN vehicle_clock_in_policy text NOT NULL DEFAULT 'flexible' CHECK(vehicle_clock_in_policy IN ('flexible','mandatory','disabled'));
ALTER TABLE public.users ADD COLUMN vehicle_policy_override text CHECK(vehicle_policy_override IN ('flexible','mandatory','disabled')), ADD COLUMN default_work_mode text NOT NULL DEFAULT 'mobile' CHECK(default_work_mode IN ('mobile','stationary'));
ALTER TABLE public.shifts ADD COLUMN vehicle_use text CHECK(vehicle_use IN ('driver','passenger','on_site'));
UPDATE public.shifts SET vehicle_use=CASE WHEN vehicle_reg IS NULL THEN 'on_site' ELSE 'driver' END WHERE shift_type='shift';
CREATE OR REPLACE FUNCTION public.guard_member_vehicle_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NOT NULL AND (NEW.vehicle_policy_override IS DISTINCT FROM OLD.vehicle_policy_override OR NEW.default_work_mode IS DISTINCT FROM OLD.default_work_mode) AND NOT(public.my_role()='superuser' OR (public.my_role()='admin' AND NOT public.has_role(OLD.id,'superuser'))) THEN RAISE EXCEPTION 'Company office admin access required'; END IF; RETURN NEW; END $$;
CREATE TRIGGER users_vehicle_settings_guard BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.guard_member_vehicle_settings();
CREATE OR REPLACE FUNCTION public.my_vehicle_clock_in_settings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('policy',coalesce(u.vehicle_policy_override,s.vehicle_clock_in_policy,'flexible'),'work_mode',u.default_work_mode) FROM public.users u LEFT JOIN public.company_settings s ON s.company_id=u.company_id WHERE u.id=auth.uid() AND u.company_id=public.current_company_id() AND public.member_is_active(auth.uid()) $$;
REVOKE ALL ON FUNCTION public.my_vehicle_clock_in_settings() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_vehicle_clock_in_settings() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_shift_vehicle_use() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE policy text; BEGIN
IF TG_OP='UPDATE' THEN IF auth.uid() IS NOT NULL AND (NEW.vehicle_use IS DISTINCT FROM OLD.vehicle_use OR NEW.vehicle_reg IS DISTINCT FROM OLD.vehicle_reg) THEN RAISE EXCEPTION 'Vehicle use is recorded at clock-in'; END IF; RETURN NEW; END IF;
IF NEW.shift_type<>'shift' THEN RETURN NEW; END IF;
SELECT coalesce(u.vehicle_policy_override,s.vehicle_clock_in_policy,'flexible') INTO policy FROM public.users u LEFT JOIN public.company_settings s ON s.company_id=u.company_id WHERE u.id=NEW.user_id AND u.company_id=NEW.company_id;
NEW.vehicle_use:=coalesce(NEW.vehicle_use,CASE WHEN NEW.vehicle_reg IS NULL THEN 'on_site' ELSE 'driver' END);
IF coalesce(policy,'flexible')='disabled' THEN NEW.vehicle_use:='on_site'; NEW.vehicle_reg:=NULL; END IF;
IF NEW.vehicle_use='on_site' THEN IF policy='mandatory' THEN RAISE EXCEPTION 'Vehicle registration is required for this member'; END IF; NEW.vehicle_reg:=NULL;
ELSE NEW.vehicle_reg:=upper(regexp_replace(coalesce(NEW.vehicle_reg,''),'\s','','g')); IF NEW.vehicle_reg !~ '^[A-Z]{3}[0-9]{3}$' THEN RAISE EXCEPTION 'Enter 3 letters and 3 numbers for your vehicle registration'; END IF; END IF;
RETURN NEW; END $$;
CREATE TRIGGER shifts_vehicle_use_guard BEFORE INSERT OR UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.guard_shift_vehicle_use();
CREATE OR REPLACE FUNCTION public.capture_fleet_location() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.shifts; interval_seconds integer; BEGIN
IF NEW.user_id<>auth.uid() OR NEW.company_id<>public.current_company_id() OR NOT public.member_is_active(auth.uid()) THEN RETURN NEW; END IF;
IF NOT public.company_module_access(NEW.company_id,'fleet_management') THEN RETURN NEW; END IF;
SELECT * INTO s FROM public.shifts WHERE id=NEW.shift_id AND company_id=NEW.company_id AND user_id=NEW.user_id AND shift_type='shift' AND ended_at IS NULL;
IF NOT FOUND OR s.vehicle_reg IS NULL OR s.vehicle_use IS DISTINCT FROM 'driver' THEN RETURN NEW; END IF;
SELECT location_ping_seconds INTO interval_seconds FROM public.company_settings WHERE company_id=NEW.company_id;
IF EXISTS(SELECT 1 FROM public.fleet_location_points WHERE shift_id=s.id AND recorded_at>now()-make_interval(secs=>coalesce(interval_seconds,30))) THEN RETURN NEW; END IF;
INSERT INTO public.fleet_location_points(company_id,user_id,shift_id,plate,latitude,longitude,accuracy,speed,recorded_at) VALUES(NEW.company_id,NEW.user_id,NEW.shift_id,s.vehicle_reg,NEW.latitude,NEW.longitude,NEW.accuracy,NEW.speed,now()); RETURN NEW; END $$;