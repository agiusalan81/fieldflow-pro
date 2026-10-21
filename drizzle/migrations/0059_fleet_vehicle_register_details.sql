ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS make_model text, ADD COLUMN IF NOT EXISTS fuel_type text NOT NULL DEFAULT 'diesel', ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.save_fleet_vehicle_details(_plate text,_litres numeric,_price numeric,_make_model text,_fuel_type text,_assigned uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF _fuel_type NOT IN ('diesel','petrol','hybrid','electric','lpg','other') THEN RAISE EXCEPTION 'Invalid fuel type'; END IF;
  IF _assigned IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id=_assigned AND u.company_id=public.current_company_id()) THEN RAISE EXCEPTION 'Technician not in company'; END IF;
  INSERT INTO public.fleet_vehicles(company_id,plate,litres_per_100km,fuel_price_per_litre,make_model,fuel_type,assigned_user_id)
  VALUES(public.current_company_id(),upper(regexp_replace(_plate,'\s','','g')),_litres,_price,nullif(trim(_make_model),''),_fuel_type,_assigned)
  ON CONFLICT(company_id,plate) DO UPDATE SET litres_per_100km=excluded.litres_per_100km,fuel_price_per_litre=excluded.fuel_price_per_litre,make_model=excluded.make_model,fuel_type=excluded.fuel_type,assigned_user_id=excluded.assigned_user_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.save_fleet_vehicle_details(text,numeric,numeric,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_fleet_vehicle_details(text,numeric,numeric,text,text,uuid) TO authenticated;