import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { DeliveryPurpose } from './client-routing';
type Recipient = {id:string;first_name:string;email:string|null;phone:string|null};
export async function clientRecipients(sb: SupabaseClient<Database>,clientId:string,siteId:string|null,purpose:DeliveryPurpose,channel:'email'|'whatsapp') {
  const r=await sb.rpc('client_message_recipients',{_client:clientId,_site:siteId as unknown as string,_purpose:purpose,_channel:channel});
  if(r.error)throw r.error;
  const contacts=r.data as unknown as Recipient[];
  const seen=new Set<string>();
  return contacts.filter(c=>{const address=channel==='email'?c.email?.trim().toLowerCase():c.phone?.replace(/\D/g,'');if(!address||seen.has(address))return false;seen.add(address);return true;});
}