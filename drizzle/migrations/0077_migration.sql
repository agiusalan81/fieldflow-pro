DO $$
DECLARE p uuid;
BEGIN
SELECT id INTO p FROM public.platform_products WHERE slug='fieldbridge';
UPDATE public.platform_catalog c SET included_seats=v.seats, storage_gb=v.gb, monthly_price=v.m, quarterly_price=round(v.m*12*0.9/4,2), yearly_price=round(v.m*12*0.8,2), modules=v.mods, state='active'
FROM (VALUES
 ('plan','Basic',3,10,89::numeric,ARRAY['core','safety','reports','branding_basic']),
 ('plan','Plus',5,25,149,ARRAY['core','safety','reports','branding_basic','custom_app_title','tracking','standby','receipts','technical_library']),
 ('plan','Pro',10,100,249,ARRAY['core','safety','reports','branding_basic','custom_app_title','tracking','standby','receipts','technical_library','fleet_management','contracts','estimates','branding_documents','branding_fonts','digitization']),
 ('plan','Enterprise',20,250,399,ARRAY['core','safety','reports','branding_basic','custom_app_title','tracking','standby','receipts','technical_library','fleet_management','contracts','estimates','branding_documents','branding_fonts','digitization','skills_dispatch','qs_pricing','supplier_email','payroll','payroll_statutory_mt','branding_advanced','branding_custom_fonts','branding_industry','client_presentation']),
 ('pack','Bronze',0,0,35,ARRAY['branding_documents','branding_custom_fonts','client_presentation','branding_fonts','branding_advanced']),
 ('pack','Silver',0,0,49,ARRAY['tracking','fleet_management','standby','receipts']),
 ('pack','Gold',0,0,59,ARRAY['estimates','qs_pricing','supplier_email','contracts','technical_library']),
 ('pack','Diamond',0,0,89,ARRAY['skills_dispatch','payroll','payroll_statutory_mt','digitization','branding_industry'])
) AS v(kind,name,seats,gb,m,mods)
WHERE c.product_id=p AND c.kind=v.kind AND c.name=v.name;
END $$;