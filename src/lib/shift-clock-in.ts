import { supabase } from '@/integrations/supabase/client';
import { normalizePlate, validPlate } from '@/lib/dwr';
import type { Profile } from '@/lib/profile';
import { toast } from 'sonner';
import { captureShiftLocation } from '@/lib/shift-location';

export async function clockInShift(profile: Profile, plate: string) {
  if (!validPlate(plate)) throw new Error('Enter 3 letters and 3 numbers for your vehicle registration.');
  const { error } = await supabase.from('shifts').insert({ shift_type: 'shift', company_id: profile.company_id, user_id: profile.id, vehicle_reg: normalizePlate(plate) });
  if (error) throw error;
  if (['technician','supervisor','maintenance'].includes(profile.real_role) && navigator.geolocation) {
    const access=await supabase.rpc('company_module_access',{_company:profile.company_id,_module:'tracking'}).catch(()=>null);
    if(!access?.data||access.error)return;
    navigator.geolocation.getCurrentPosition(() => {
      localStorage.setItem(`location-consent:${profile.id}`, 'yes');
      window.dispatchEvent(new Event('location-consent'));
      void (async()=>{const r=await supabase.from('shifts').select('id').eq('user_id',profile.id).is('ended_at',null).eq('shift_type','shift').order('started_at',{ascending:false}).limit(1).maybeSingle();if(r.data)await captureShiftLocation(profile,r.data.id,'clock_in');})().catch(()=>{});
    }, () => toast.warning('Location is off — turn it on in your browser settings so your shift location can be shared.'), { timeout: 20000 });
  }
}