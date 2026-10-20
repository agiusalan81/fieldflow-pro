import { supabase } from '@/integrations/supabase/client';
import { normalizePlate, validPlate } from '@/lib/dwr';
import type { Profile } from '@/lib/profile';
import { toast } from 'sonner';

export async function clockInShift(profile: Profile, plate: string) {
  if (!validPlate(plate)) throw new Error('Enter 3 letters and 3 numbers for your vehicle registration.');
  const { error } = await supabase.from('shifts').insert({ shift_type: 'shift', company_id: profile.company_id, user_id: profile.id, vehicle_reg: normalizePlate(plate) });
  if (error) throw error;
  if ((profile.real_role === 'technician' || profile.real_role === 'supervisor') && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(() => {
      localStorage.setItem(`location-consent:${profile.id}`, 'yes');
      window.dispatchEvent(new Event('location-consent'));
    }, () => toast.warning('Location is off — turn it on in your browser settings so your shift location can be shared.'), { timeout: 20000 });
  }
}