import { useRef,useState } from 'react';
import { Camera,ImagePlus,X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prepareQrPhoto } from '@/lib/qr-report-photo';
import { getReportPhoto } from '@/lib/qr-report-photo.functions';
import { useQuery } from '@tanstack/react-query';

export function QrReportPhoto({value,onChange,disabled}:{value:string;onChange:(v:string)=>void;disabled:boolean}) {
  const camera=useRef<HTMLInputElement>(null); const gallery=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const pick=async(file?:File)=>{if(!file)return;setBusy(true);setError('');try{onChange(await prepareQrPhoto(file));}catch(e){setError(e instanceof Error?e.message:'Photo could not be opened.');}finally{setBusy(false);}};
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled||busy} onClick={()=>camera.current?.click()}><Camera className="mr-2 size-4"/>Take photo</Button><Button type="button" variant="outline" disabled={disabled||busy} onClick={()=>gallery.current?.click()}><ImagePlus className="mr-2 size-4"/>Choose photo</Button></div>
    <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="Take report photo" className="hidden" onChange={e=>{void pick(e.target.files?.[0]);e.target.value='';}}/>
    <input ref={gallery} type="file" accept="image/*" aria-label="Choose report photo" className="hidden" onChange={e=>{void pick(e.target.files?.[0]);e.target.value='';}}/>
    {busy&&<p role="status" className="text-sm text-muted-foreground">Preparing photo…</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {value&&<div className="relative w-40"><img src={value} alt="Report photo preview" className="aspect-square rounded-md object-cover"/><Button type="button" size="icon" variant="secondary" aria-label="Remove photo" className="absolute right-1 top-1" disabled={disabled} onClick={()=>onChange('')}><X className="size-4"/></Button></div>}
  </div>;
}
export function ReportPhoto({reportId,kind}:{reportId:string;kind:'equipment'|'store'}) {
  const q=useQuery({queryKey:['qr-report-photo',kind,reportId],queryFn:()=>getReportPhoto({data:{reportId,kind}}),staleTime:240000});
  if(q.error)return <p role="alert" className="text-sm text-destructive">Photo could not be loaded. <Button variant="link" onClick={()=>q.refetch()}>Retry</Button></p>;
  return q.data?.url?<a href={q.data.url} target="_blank" rel="noreferrer"><img src={q.data.url} alt="Reported defect evidence" className="mb-3 aspect-square w-40 rounded-md object-cover"/></a>:null;
}