import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/lib/profile';
/** Capture once at clock action; absence is explicit rather than reconstructed from later history. */
export async function captureShiftLocation(profile:Profile,shiftId:string,event:'clock_in'|'clock_out') {
  try {
  if(!['technician','supervisor','maintenance'].includes(profile.real_role)||!navigator.geolocation)return false;
  if(event==='clock_out'&&localStorage.getItem(`location-consent:${profile.id}`)!=='yes')return false;
  const allowed=await supabase.rpc('company_module_access',{_company:profile.company_id,_module:'tracking'});
  if(allowed.error||!allowed.data)return false;
  const position=await new Promise<GeolocationPosition|null>(resolve=>navigator.geolocation.getCurrentPosition(resolve,()=>resolve(null),{enableHighAccuracy:true,maximumAge:0,timeout:8000}));
  if(!position)return false;
  const r=await supabase.rpc('record_shift_location',{_shift:shiftId,_event:event,_latitude:position.coords.latitude,_longitude:position.coords.longitude,_accuracy:position.coords.accuracy});
  return !r.error;
  } catch { return false; }
}