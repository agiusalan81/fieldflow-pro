import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useProfile} from '@/lib/profile';
import {useUserPreview} from '@/lib/impersonation';
import {shouldShareLocation} from '@/lib/field-documents';
import {useCompanyRules} from '@/lib/company';
import {usePlanFeatures} from '@/lib/plan-features';
export function LocationSharing(){
 const{data:profile}=useProfile();const on=usePlanFeatures(!!profile);const{data:company}=useCompanyRules();const pingMs=(company?.pingSeconds??30)*1000;const{active:preview}=useUserPreview(profile);const[consent,setConsent]=useState(false),[,setStatus]=useState('');
 const query=useQuery({queryKey:['open-shifts',profile?.id],enabled:!!profile&&!preview,queryFn:async()=>{const r=await supabase.from('shifts').select('*').eq('user_id',profile?.id??'').is('ended_at',null);if(r.error)throw r.error;return r.data;},refetchInterval:15000});
 const shift=query.data?.find(s=>s.shift_type==='shift');
 useEffect(()=>{if(!profile)return;const read=()=>setConsent(localStorage.getItem(`location-consent:${profile.id}`)==='yes');read();window.addEventListener('location-consent',read);return()=>window.removeEventListener('location-consent',read);},[profile?.id]);
 useEffect(()=>{if(!profile||preview||shift?.vehicle_use==='on_site'||!on('tracking')||!shouldShareLocation(consent,shift)||!navigator.geolocation)return;let last=0,writing=false,cancelled=false;
 const watch=navigator.geolocation.watchPosition(async p=>{if(cancelled||writing||Date.now()-last<pingMs)return;writing=true;last=Date.now();try{const r=await supabase.from('technician_locations').upsert({user_id:profile.id,company_id:profile.company_id,shift_id:shift?.id??'',latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed});if(!cancelled)setStatus(r.error?`Location not shared: ${r.error.message}`:'Location sharing active');}finally{writing=false;}},e=>setStatus(e.code===1?'Location permission denied — enable it in browser settings.':'Location unavailable — waiting for a GPS fix.'),{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
 return()=>{cancelled=true;navigator.geolocation.clearWatch(watch);setStatus('');};},[profile?.id,profile?.company_id,consent,shift?.id,shift?.vehicle_use,preview,pingMs,on('tracking')]);
 // No on-screen notice: consent is asked at clock-in; tracking runs silently during the shift.
 return null;
}
