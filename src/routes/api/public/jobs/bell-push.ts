import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route=createFileRoute('/api/public/jobs/bell-push')({staticData:{sitemap:false},server:{handlers:{POST:async({request})=>{
  const denied=await authenticateCronRequest(request);if(denied)return denied;
  const {sendPendingBellPush}=await import('@/lib/bell-push.server');
  try{return Response.json(await sendPendingBellPush());}catch{return Response.json({error:'Alert delivery unavailable'},{status:503});}
}}}});