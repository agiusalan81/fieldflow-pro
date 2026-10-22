import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QrCode, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfile, isManager } from '@/lib/profile';
import { useCompanyRules } from '@/lib/company';
import { brandedQr } from '@/lib/qr-sticker';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';

const LABELS = { technical: 'Technical data & history', report: 'Report a fault' } as const;

function Sticker({title,reference,src,logo,company}:{title:string;reference:string;src:string;logo?:string|undefined;company:string}){
 return <div className="mx-auto w-full max-w-[280px] rounded-lg border bg-card p-4 text-center text-card-foreground">
  <p className="text-xs text-muted-foreground">{reference}</p>
  <p className="mb-3 font-medium">{title}</p>
  <img src={src} alt={`${title} QR`} className="mx-auto h-52 w-52"/>
  <div className="mt-3 flex items-center justify-center gap-2 border-t pt-3">{logo&&<img src={logo} alt="" className="h-7 w-7 object-contain"/>}<span className="truncate text-sm font-medium">{company}</span></div>
 </div>;
}

export function EquipmentQr({assetId,reference}:{assetId:string;reference:string}) {
 const {data:p}=useProfile();const {data:company}=useCompanyRules();const qc=useQueryClient();
 const [open,setOpen]=useState(false);const [technical,setTechnical]=useState('');const [report,setReport]=useState('');const [busy,setBusy]=useState(false);
 const logo=company?.logo||undefined;const companyName=p?.companies?.name??'';
 const links=useQuery({queryKey:['equipment-report-links',assetId],enabled:open&&isManager(p),queryFn:async()=>{const r=await supabase.from('equipment_report_links').select('id,created_at,revoked_at').eq('asset_id',assetId).order('created_at',{ascending:false});if(r.error)throw r.error;return r.data;}});
 const show=async()=>{try{setTechnical(await brandedQr(`${window.location.origin}/auth?equipment=${assetId}`,logo));setOpen(true);}catch{toast.error('Could not prepare QR');}};
 const create=async()=>{setBusy(true);try{const r=await supabase.rpc('create_equipment_report_link',{_asset:assetId});if(r.error)throw r.error;setReport(await brandedQr(`${window.location.origin}/problem/${r.data}`,logo));await qc.invalidateQueries({queryKey:['equipment-report-links',assetId]});}catch(e){toast.error(e instanceof Error?e.message:'Could not create report QR');}finally{setBusy(false);}};
 const print=()=>{const w=window.open('','_blank');if(!w){toast.error('Allow pop-ups to print labels');return;}
  const style=w.document.createElement('style');style.textContent='body{font-family:system-ui,sans-serif;margin:0;padding:8mm}section{display:inline-block;vertical-align:top;width:70mm;margin:4mm;padding:5mm;border:0.3mm solid #999;border-radius:3mm;text-align:center;break-inside:avoid}h2{font-size:12pt;margin:0 0 1mm}p{font-size:9pt;margin:0 0 3mm;color:#555}img.qr{width:56mm;height:56mm}footer{display:flex;align-items:center;justify-content:center;gap:2mm;border-top:0.3mm solid #ddd;margin-top:3mm;padding-top:2mm;font-size:10pt;font-weight:600}footer img{height:8mm;width:8mm;object-fit:contain}';w.document.head.append(style);
  for(const [label,src] of ([[LABELS.technical,technical],[LABELS.report,report]] as const)){if(!src)continue;const s=w.document.createElement('section');const ref=w.document.createElement('p');ref.textContent=reference;const h=w.document.createElement('h2');h.textContent=label;const img=w.document.createElement('img');img.className='qr';img.src=src;const f=w.document.createElement('footer');if(logo){const l=w.document.createElement('img');l.src=logo;f.append(l);}const n=w.document.createElement('span');n.textContent=companyName;f.append(n);s.append(h,ref,img,f);w.document.body.append(s);}
  Promise.all([...w.document.images].map(i=>i.decode().catch(()=>{}))).then(()=>w.print());};
 return <><Button variant="ghost" size="icon" aria-label={`QR labels for ${reference}`} onClick={show}><QrCode className="h-4 w-4"/></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Equipment QR stickers · {reference}</DialogTitle></DialogHeader>
  <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2">{technical&&<Sticker title={LABELS.technical} reference={reference} src={technical} logo={logo} company={companyName}/>}<p className="text-xs text-muted-foreground">Registered team only. Company access and document restrictions still apply.</p></div>
  <div className="space-y-2">{report?<Sticker title={LABELS.report} reference={reference} src={report} logo={logo} company={companyName}/>:<p className="py-8 text-sm text-muted-foreground">Public fault form · no technical or client information.</p>}{isManager(p)&&<Button variant="outline" disabled={busy} onClick={create}>{busy?'Preparing…':'Create report QR'}</Button>}</div></div>
  <Button variant="outline" onClick={print}><Printer className="mr-2 h-4 w-4"/>Print stickers</Button>
  {links.data?.filter(l=>!l.revoked_at).map(l=><div key={l.id} className="flex items-center justify-between border-t pt-2 text-xs"><span>Reporting label created {l.created_at?.slice(0,10)}</span><Button variant="ghost" size="sm" onClick={async()=>{if(!confirm('Disable this reporting QR?'))return;const r=await supabase.from('equipment_report_links').update({revoked_at:new Date().toISOString()}).eq('id',l.id);if(r.error)toast.error(r.error.message);else{setReport('');await qc.invalidateQueries({queryKey:['equipment-report-links',assetId]});}}}>Revoke</Button></div>)}
 </DialogContent></Dialog></>;
}
