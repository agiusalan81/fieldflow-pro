CREATE TABLE public.fleet_vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), plate text NOT NULL,
 litres_per_100km numeric NOT NULL DEFAULT 0 CHECK (litres_per_100km >= 0 AND litres_per_100km <= 100),
 fuel_price_per_litre numeric NOT NULL DEFAULT 0 CHECK (fuel_price_per_litre >= 0 AND fuel_price_per_litre <= 100),
 UNIQUE(company_id,plate), CHECK (plate ~ '^[A-Z]{3}[0-9]{3}$')
);
GRANT SELECT,INSERT,UPDATE ON public.fleet_vehicles TO authenticated;
GRANT ALL ON public.fleet_vehicles TO service_role;
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY fleet_vehicle_read ON public.fleet_vehicles FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND public.is_company_manager() AND public.company_module_access(company_id,'fleet_management'));
CREATE POLICY fleet_vehicle_insert ON public.fleet_vehicles FOR INSERT TO authenticated WITH CHECK (company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND public.my_role() IN ('admin','superuser') AND public.company_module_access(company_id,'fleet_management'));
CREATE POLICY fleet_vehicle_update ON public.fleet_vehicles FOR UPDATE TO authenticated USING (company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND public.my_role() IN ('admin','superuser') AND public.company_module_access(company_id,'fleet_management')) WITH CHECK (company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND public.my_role() IN ('admin','superuser') AND public.company_module_access(company_id,'fleet_management'));
CREATE TABLE public.fleet_location_points (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), user_id uuid NOT NULL,
 shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
 plate text, latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
 accuracy double precision NOT NULL CHECK (accuracy>=0), speed double precision, recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fleet_location_points TO authenticated;
GRANT ALL ON public.fleet_location_points TO service_role;
ALTER TABLE public.fleet_location_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY fleet_history_read ON public.fleet_location_points FOR SELECT TO authenticated USING (company_id=public.current_company_id() AND public.member_is_active(auth.uid()) AND public.is_company_manager() AND public.company_module_access(company_id,'fleet_management'));
CREATE INDEX fleet_history_user_time ON public.fleet_location_points(company_id,user_id,recorded_at);
CREATE OR REPLACE FUNCTION public.capture_fleet_location() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.shifts; interval_seconds integer;
BEGIN
 IF NEW.user_id<>auth.uid() OR NEW.company_id<>public.current_company_id() OR NOT public.member_is_active(auth.uid()) THEN RETURN NEW; END IF;
 IF NOT public.company_module_access(NEW.company_id,'fleet_management') THEN RETURN NEW; END IF;
 SELECT * INTO s FROM public.shifts WHERE id=NEW.shift_id AND company_id=NEW.company_id AND user_id=NEW.user_id AND shift_type='shift' AND ended_at IS NULL;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT location_ping_seconds INTO interval_seconds FROM public.company_settings WHERE company_id=NEW.company_id;
 IF EXISTS (SELECT 1 FROM public.fleet_location_points WHERE shift_id=s.id AND recorded_at>now()-make_interval(secs=>coalesce(interval_seconds,30))) THEN RETURN NEW; END IF;
 INSERT INTO public.fleet_location_points(company_id,user_id,shift_id,plate,latitude,longitude,accuracy,speed,recorded_at)
 VALUES(NEW.company_id,NEW.user_id,NEW.shift_id,s.vehicle_reg,NEW.latitude,NEW.longitude,NEW.accuracy,NEW.speed,now());
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_fleet_location() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_fleet_history AFTER INSERT OR UPDATE ON public.technician_locations FOR EACH ROW EXECUTE FUNCTION public.capture_fleet_location();
CREATE OR REPLACE FUNCTION public.fleet_day(_user uuid,_date date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.recorded_at),'[]'::jsonb) FROM public.fleet_location_points p
WHERE p.user_id=_user AND p.recorded_at>=(_date::timestamp AT TIME ZONE 'Europe/Malta') AND p.recorded_at<((_date+1)::timestamp AT TIME ZONE 'Europe/Malta');
$$;
GRANT EXECUTE ON FUNCTION public.fleet_day(uuid,date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fleet_day(uuid,date) FROM PUBLIC,anon;
CREATE OR REPLACE FUNCTION public.fleet_vehicle_list() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY plate),'[]'::jsonb) FROM public.fleet_vehicles v $$;
REVOKE EXECUTE ON FUNCTION public.fleet_vehicle_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fleet_vehicle_list() TO authenticated;
CREATE OR REPLACE FUNCTION public.save_fleet_vehicle(_plate text,_litres numeric,_price numeric) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
INSERT INTO public.fleet_vehicles(company_id,plate,litres_per_100km,fuel_price_per_litre) VALUES(public.current_company_id(),upper(regexp_replace(_plate,'\s','','g')),_litres,_price)
ON CONFLICT(company_id,plate) DO UPDATE SET litres_per_100km=excluded.litres_per_100km,fuel_price_per_litre=excluded.fuel_price_per_litre;
$$;
REVOKE EXECUTE ON FUNCTION public.save_fleet_vehicle(text,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_fleet_vehicle(text,numeric,numeric) TO authenticated;