import { supabase } from '@/integrations/supabase/client';
import { vehicleShiftFields, type VehicleUse } from '@/lib/vehicle-clock-in';
import type { Profile } from '@/lib/profile';
import { captureShiftLocation } from '@/lib/shift-location';
import { confirmFieldLocation, fieldDeviceReady, requiresFieldDevice } from '@/lib/field-device';
import { registerPush } from '@/lib/web-push';
import { boundedPermission } from '@/lib/permission-sequence';

export async function clockInShift(profile: Profile, plate: string, use: VehicleUse = 'driver') {
  const fields = vehicleShiftFields('flexible', use, plate);
  if (requiresFieldDevice(profile.real_role, profile.can_field_dispatch)) {
    const push = await boundedPermission(registerPush, 25000);
    if (push !== 'registered') throw new Error('Enable notifications in device setup before clocking in.');
    const geo = await confirmFieldLocation(profile.id);
    if (!fieldDeviceReady(push, geo)) throw new Error('Location is unavailable. Enable location and get a GPS fix before clocking in.');
  }
  const { error } = await supabase.from('shifts').insert({ shift_type: 'shift', company_id: profile.company_id, user_id: profile.id, ...fields });
  if (error) throw error;
  if (requiresFieldDevice(profile.real_role, profile.can_field_dispatch) && navigator.geolocation) {
    const access=await Promise.resolve(supabase.rpc('company_module_access',{_company:profile.company_id,_module:'tracking'})).catch(()=>null);
    if(!access?.data||access.error)return;
    void (async()=>{const r=await supabase.from('shifts').select('id').eq('user_id',profile.id).is('ended_at',null).eq('shift_type','shift').order('started_at',{ascending:false}).limit(1).maybeSingle();if(r.data)await captureShiftLocation(profile,r.data.id,'clock_in');})().catch(()=>{});
  }
}