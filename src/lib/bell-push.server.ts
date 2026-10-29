import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { deliver } from '@/lib/web-push-delivery.server';

/** Scheduled, server-derived queue reconciliation; no browser-provided recipients. */
export async function sendPendingBellPush() {
  const lease=await supabaseAdmin.rpc('acquire_bell_push_runner');
  if(lease.error)throw new Error('Could not acquire alert runner');
  if(!lease.data)return {accepted:0,failed:0,checked:0};
  try {
  const q=await supabaseAdmin.rpc('pending_bell_push'); if(q.error)throw new Error('Could not read pending alerts');
  let accepted=0,failed=0;
  for(const alert of q.data??[]){
    const subs=await supabaseAdmin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id',alert.user_id);
    if(subs.error){failed++;continue;}
    // Do not mark an event delivered before the recipient enables notifications.
    if(!subs.data?.length)continue;
    const sent=await deliver(supabaseAdmin,subs.data,{title:alert.title,body:'An action is waiting for you. Tap to open it.',url:alert.url,tag:alert.event_key});
    if(sent){const saved=await supabaseAdmin.from('bell_push_deliveries').upsert({event_key:alert.event_key,user_id:alert.user_id},{onConflict:'event_key,user_id'});if(saved.error)failed++;else accepted+=sent;}else failed++;
  }
  return {accepted,failed,checked:q.data?.length??0};
  }finally{await supabaseAdmin.rpc('release_bell_push_runner');}
}