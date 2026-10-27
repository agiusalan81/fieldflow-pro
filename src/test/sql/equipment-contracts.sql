BEGIN;
DO $$
DECLARE actor uuid='457c0821-0251-4c77-b768-c0ffd0f17ba9'; tenant uuid; client uuid; site uuid; asset1 uuid; asset2 uuid; contract uuid; doc uuid; sheet uuid; plan uuid;
BEGIN
SELECT company_id INTO tenant FROM public.user_roles WHERE user_id=actor AND registration_status='active';
SELECT id INTO client FROM public.clients WHERE company_id=tenant LIMIT 1;
IF client IS NULL THEN RAISE EXCEPTION 'Active company/client fixture required'; END IF;
PERFORM set_config('request.jwt.claim.sub',actor::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.sites(company_id,client_id,name) VALUES(tenant,client,'Contract rollback test') RETURNING id INTO site;
INSERT INTO public.assets(company_id,client_id,site_id,reference_number,asset_category) VALUES(tenant,client,site,'Contract test one','Passenger Lift') RETURNING id INTO asset1;
INSERT INTO public.assets(company_id,client_id,site_id,reference_number,asset_category) VALUES(tenant,client,site,'Contract test two','Hydraulic Lift') RETURNING id INTO asset2;
SELECT id INTO doc FROM public.document_masters WHERE company_id=tenant AND state='active' AND kind='checklist' LIMIT 1;
contract=public.save_equipment_contract(jsonb_build_object('client_id',client,'site_id',site,'start','2026-02-01','end','2027-09-01','title','Rollback equipment contract','price',''),jsonb_build_array(jsonb_build_object('asset_id',asset1,'checklist_id',doc,'price',1200,'start','2026-02-01','end','2027-02-01','months',1),jsonb_build_object('asset_id',asset2,'price',450,'start','2026-09-01','end','2027-09-01','months',3)));
IF (SELECT annual_price FROM public.maintenance_agreements WHERE id=contract)<>1650 THEN RAISE EXCEPTION 'Expected aggregated price 1650'; END IF;
IF (SELECT end_date FROM public.agreement_assets WHERE agreement_id=contract AND asset_id=asset1)<>'2027-02-01' THEN RAISE EXCEPTION 'Equipment February expiry lost'; END IF;
IF (SELECT start_date FROM public.agreement_assets WHERE agreement_id=contract AND asset_id=asset2)<>'2026-09-01' THEN RAISE EXCEPTION 'Equipment September start lost'; END IF;
BEGIN
UPDATE public.agreement_assets SET annual_price=1 WHERE agreement_id=contract;
RAISE EXCEPTION 'Frozen agreed price changed';
EXCEPTION WHEN raise_exception THEN IF SQLERRM='Frozen agreed price changed' THEN RAISE; END IF; END;
UPDATE public.agreement_assets SET start_date='2027-02-02',end_date='2028-02-01' WHERE agreement_id=contract AND asset_id=asset1;
IF (SELECT jsonb_array_length(renewal_history) FROM public.agreement_assets WHERE agreement_id=contract AND asset_id=asset1)<>1 THEN RAISE EXCEPTION 'Renewal did not retain previous dates'; END IF;
RESET ROLE;
END $$;
ROLLBACK;