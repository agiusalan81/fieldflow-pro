-- Read-only regression for the approved AisleOps catalog; run against the live database.
DO $$
BEGIN
 IF (SELECT count(*) FROM public.platform_catalog c JOIN public.platform_products p ON p.id=c.product_id
 WHERE p.engine_edition='retail' AND c.kind='plan' AND c.state='active' AND
 ((c.name='Store Essentials' AND c.monthly_price=119 AND c.quarterly_price=339.15 AND c.yearly_price=1213.80 AND c.included_seats=5 AND c.storage_gb=15)
 OR (c.name='Multi-Store Pro' AND c.monthly_price=249 AND c.quarterly_price=709.65 AND c.yearly_price=2539.80 AND c.included_seats=12 AND c.storage_gb=50)
 OR (c.name='Enterprise & Central Production' AND c.monthly_price=399 AND c.quarterly_price=1137.15 AND c.yearly_price=4069.80 AND c.included_seats=25 AND c.storage_gb=150))) <> 3 THEN
 RAISE EXCEPTION 'Approved AisleOps plan pricing/allowances differ'; END IF;
 IF (SELECT count(*) FROM public.platform_catalog c JOIN public.platform_products p ON p.id=c.product_id
 WHERE p.engine_edition='retail' AND c.state='active' AND c.kind='pack' AND
 ((c.monthly_price=15 AND c.storage_gb=25 AND cardinality(c.modules)=0)
 OR (c.monthly_price=35 AND c.storage_gb=100 AND cardinality(c.modules)=0)
 OR (c.monthly_price=85 AND c.storage_gb=500 AND cardinality(c.modules)=0)
 OR (c.monthly_price=59 AND c.name='Central Production & Bakery Pack' AND c.modules @> ARRAY['technical_library','digitization']))) <> 4 THEN
 RAISE EXCEPTION 'Approved AisleOps packs differ'; END IF;
END $$;