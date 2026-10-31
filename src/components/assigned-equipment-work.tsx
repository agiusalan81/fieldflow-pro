import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientContractDocuments } from '@/components/client-contract-documents';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function AssignedEquipmentWork({companyId}:{companyId:string}) {
  const [client,setClient]=useState<string|null>(null);
  const q=useQuery({queryKey:['client-document-matrix','contract-assignment-list'],queryFn:async()=>{const r=await supabase.from('document_attachments').select('id,client_id,document_masters(name,kind,items),assets(reference_number),sites(name),clients(name)').order('created_at',{ascending:false});if(r.error)throw r.error;return r.data;}});
  const rows=q.data?.filter(r=>r.document_masters?.kind==='checklist'||r.document_masters?.kind==='schedule'||r.document_masters?.items.some(item=>item.trim()))??[];
  return <section className="space-y-3 border-y py-4"><h2 className="font-semibold">Assigned equipment checklists & schedules</h2>{q.error&&<p role="alert" className="text-destructive">Assignments could not be loaded.</p>}<ul className="divide-y">{rows.map(r=><li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{r.assets?.reference_number??r.sites?.name??'Whole client'} · {r.document_masters?.name}</p><p className="text-muted-foreground">{r.clients?.name} · {r.sites?.name}</p></div><Button size="sm" variant="outline" onClick={()=>setClient(r.client_id)}>Open assignments</Button></li>)}</ul>{!q.isPending&&!rows.length&&<p className="text-sm text-muted-foreground">No equipment checklists or schedules assigned.</p>}<Dialog open={!!client} onOpenChange={v=>{if(!v)setClient(null);}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Client equipment assignments</DialogTitle></DialogHeader>{client&&<ClientContractDocuments companyId={companyId} clientId={client}/>}</DialogContent></Dialog></section>;
}