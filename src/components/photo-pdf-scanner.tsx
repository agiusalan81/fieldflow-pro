import {useState,useRef,useEffect} from 'react';
import {Camera,Plus,Trash2,FileCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {photosToPdf} from '@/lib/pdf-tools';
import {toast} from 'sonner';
function Photo({file}:{file:File}){const[url,setUrl]=useState('');useEffect(()=>{const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u);},[file]);return <img src={url} alt="Scanned page" className="h-32 w-full object-contain"/>;}
export function PhotoPdfScanner({onAttach,label='Attach PDF'}:{onAttach:(blob:Blob,pages:number)=>Promise<void>;label?:string}){
 const [files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false);const camera=useRef<HTMLInputElement>(null),gallery=useRef<HTMLInputElement>(null);
 const add=(list:FileList|null)=>{if(list)setFiles(old=>[...old,...Array.from(list)]);};
 const attach=async()=>{setBusy(true);try{const pdf=await photosToPdf(files);await onAttach(pdf,files.length);setFiles([]);}catch(e){toast.error(e instanceof Error?e.message:'Could not attach scan');}finally{setBusy(false);}};
 return <div className="space-y-3"><input id={camId} ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={e=>{add(e.target.files);e.target.value='';}}/><input id={galId} ref={gallery} type="file" accept="image/*" multiple className="sr-only" onChange={e=>{add(e.target.files);e.target.value='';}}/><div className="flex flex-wrap gap-2"><Button asChild variant="outline" className={busy?"pointer-events-none opacity-50":""}><label htmlFor={camId}><Camera className="mr-2 h-4 w-4"/>Camera</label></Button><Button asChild variant="outline" className={busy?"pointer-events-none opacity-50":""}><label htmlFor={galId}><Plus className="mr-2 h-4 w-4"/>Add photos</label></Button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{files.map((f,i)=><div key={i} className="relative rounded-md border p-2"><Photo file={f}/><span className="text-xs">Page {i+1}</span><Button variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={`Remove page ${i+1}`} disabled={busy} onClick={()=>setFiles(files.filter((_,j)=>i!==j))}><Trash2 className="h-4 w-4"/></Button></div>)}</div>{files.length>0&&<Button disabled={busy} onClick={attach}><FileCheck className="mr-2 h-4 w-4"/>{busy?'Preparing PDF…':label}</Button>}</div>;
}
