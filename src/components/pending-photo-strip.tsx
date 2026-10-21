import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parsePhotos } from '@/lib/jobsheets';
import type { Json } from '@/integrations/supabase/types';
export function PendingPhotoStrip({sheetId,photos,onOpen}:{sheetId:string;photos:Json;onOpen:()=>void}) {
  const pending=parsePhotos(photos).filter(p=>p.scope==='pending');
  const q=useQuery({queryKey:['pending-thumbnails',sheetId,pending.map(p=>p.path).join('|')],enabled:pending.length>0,staleTime:240000,queryFn:async()=>{const r=await supabase.storage.from('job-photos').createSignedUrls(pending.slice(0,4).map(p=>p.path),300);if(r.error)throw r.error;return r.data;}});
  if(!pending.length)return null;
  return <div className="mt-3 flex gap-2" onClick={e=>e.stopPropagation()}>{q.data?.map((p,i)=>p.signedUrl&&<a key={p.path} href={p.signedUrl} target="_blank" rel="noreferrer" aria-label={`Pending photo ${i+1}`}><img src={p.signedUrl} alt="Pending work" className="h-16 w-16 rounded-md object-cover"/></a>)}{(q.error||!q.data)&&<span className="text-xs text-muted-foreground">{q.error?'Photos unavailable':'Loading photos…'}</span>}{pending.length>4&&<span className="self-center text-xs">+{pending.length-4}</span>}</div>;
}