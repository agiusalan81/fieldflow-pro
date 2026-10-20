import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {MapPin,ShieldCheck} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {useProfile} from '@/lib/profile';
import {useUserPreview} from '@/lib/impersonation';
import {Button} from '@/components/ui/button';
import {shouldShareLocation} from '@/lib/field-documents';
import {useCompanyRules} from '@/lib/company';
export function LocationSharing(){
 const{data:profile}=useProfile();const{data:company}=useCompanyRules();const pingMs=(company?.pingSeconds??30)*1000;const{active:preview}=useUserPreview(profile);const[consent,setConsent]=useState(false),[status,setStatus]=useState(''),[ready,setReady]=useState(false);
 const query=useQuery({queryKey:['open-shifts',profile?.id],enabled:!!profile&&!preview,queryFn:async()=>{const r=await supabase.from('shifts').select('*').eq('user_id',profile?.id??'').is('ended_at',null);if(r.error)throw r.error;return r.data;},refetchInterval:15000});
 const shift=query.data?.find(s=>s.shift_type==='shift');
 useEffect(()=>{if(!profile)return;const read=()=>setConsent(localStorage.getItem(`location-consent:${profile.id}`)==='yes');read();setReady(true);window.addEventListener('location-consent',read);return()=>window.removeEventListener('location-consent',read);},[profile?.id]);
 useEffect(()=>{if(!profile||preview||!shouldShareLocation(consent,shift)||!navigator.geolocation)return;let last=0,writing=false,cancelled=false;
 const watch=navigator.geolocation.watchPosition(async p=>{if(cancelled||writing||Date.now()-last<pingMs)return;writing=true;last=Date.now();try{const r=await supabase.from('technician_locations').upsert({user_id:profile.id,company_id:profile.company_id,shift_id:shift?.id??'',latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed});if(!cancelled)setStatus(r.error?`Location not shared: ${r.error.message}`:'Location sharing active');}finally{writing=false;}},e=>setStatus(e.code===1?'Location permission denied — enable it in browser settings.':'Location unavailable — waiting for a GPS fix.'),{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
 return()=>{cancelled=true;navigator.geolocation.clearWatch(watch);setStatus('');};},[profile?.id,profile?.company_id,consent,shift?.id,preview,pingMs]);
 if(!profile||preview||!ready||!consent||!shift||(profile.real_role!=='technician'&&profile.real_role!=='supervisor'))return null;
 const enable=()=>{if(!navigator.geolocation){setStatus('Location is unavailable in this browser.');return;}navigator.geolocation.getCurrentPosition(()=>{localStorage.setItem(`location-consent:${profile.id}`,'yes');setConsent(true);setStatus('Permission granted');},()=>setStatus('Permission not granted. You can continue working without location sharing.'),{timeout:20000});};
 return <div className="mb-3 border-l-2 border-primary pl-3 text-sm"><div className="flex flex-wrap items-center gap-2"><MapPin className="h-4 w-4"/><span>{consent?(shift?status||'Waiting for location…':'Location sharing paused — off shift'):'Share location during your shift'}</span>{consent?<Button size="sm" variant="ghost" onClick={()=>{localStorage.removeItem(`location-consent:${profile.id}`);setConsent(false);void supabase.from("technician_locations").delete().eq("user_id",profile.id);}}>Stop sharing</Button>:<Button size="sm" variant="outline" onClick={enable}><ShieldCheck className="mr-2 h-4 w-4"/>Allow location</Button>}</div>{!consent&&<p className="mt-1 text-xs text-muted-foreground">Visible to your company managers only while clocked in. Browser background tracking is not guaranteed.</p>}</div>;
}
