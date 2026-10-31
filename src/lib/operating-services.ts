export const SERVICE_GROUPS = [
 {category:'Vertical Transportation',items:[['lifts','Lifts'],['escalators','Escalators & Moving Walkways']]},
 {category:'HVAC & Climate',items:[['air_conditioning','Air Conditioning & Heat Pumps'],['heating','Heating & Boilers'],['ventilation','Ventilation & Air Extraction'],['refrigeration','Commercial Refrigeration']]},
 {category:'Electrical, Mechanical & Public Health',items:[['electrical','Electrical'],['plumbing','Plumbing & Sanitary'],['drains','Drains & Drainage'],['mechanical','Mechanical Plant'],['renewables','Renewables & EV Infrastructure']]},
 {category:'Fire, Life Safety & Security',items:[['fire_detection','Fire Alarms & Detection'],['fire_suppression','Fire Suppression & Extinguishers'],['safety','Safety & Emergency Lighting'],['security','Intruder Alarms & Security'],['cctv','CCTV'],['access_control','Access Control & Automated Doors']]},
 {category:'Building Fabric & Facilities',items:[['construction','Construction & Fit-out'],['catering','Commercial Catering Equipment'],['general_maintenance','General Facilities Maintenance'],['water_treatment','Water Treatment & Legionella Control']]},
] as const;
export const LEGACY_SERVICE_KEYS:Record<string,string[]>={elevator:['lifts','escalators'],hvac:['air_conditioning','heating','ventilation','refrigeration'],fire_security:['fire_detection','fire_suppression','safety','security','cctv','access_control']};
export function expandServices(keys:string[]) {return [...new Set(keys.flatMap(k=>LEGACY_SERVICE_KEYS[k]??[k]))];}
export function toggleServices(selected:string[],keys:string[],on:boolean) {return on?[...new Set([...selected,...keys])]:selected.filter(k=>!keys.includes(k));}