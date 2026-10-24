import {useEffect,useRef,useState} from 'react';
import ReactCrop, {type PercentCrop} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {Button} from '@/components/ui/button';
import {Crop,RotateCcw} from 'lucide-react';
import {toast} from 'sonner';
export function ReceiptCrop({file,onSave,onCancel}:{file:File;onSave:(file:File)=>void;onCancel:()=>void}){
 const [url,setUrl]=useState(''),[crop,setCrop]=useState<PercentCrop>({unit:'%',x:0,y:0,width:100,height:100}),[busy,setBusy]=useState(false);
 const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u);},[file]);
 const save=async()=>{const img=image.current;if(!img)return;setBusy(true);try{
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*crop.width/100));canvas.height=Math.max(1,Math.round(img.naturalHeight*crop.height/100));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Cropping unavailable');
 ctx.drawImage(img,img.naturalWidth*crop.x/100,img.naturalHeight*crop.y/100,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not crop receipt')),'image/jpeg',0.95));
 onSave(new File([blob],file.name,{type:'image/jpeg'}));
 }catch(e){toast.error(e instanceof Error?e.message:'Could not crop receipt');}finally{setBusy(false);}};
 return <div className="space-y-3"><ReactCrop crop={crop} onChange={(_,percent)=>setCrop(percent)} minWidth={10} minHeight={10}><img ref={image} src={url} alt="Receipt crop" className="max-h-[55dvh] w-auto object-contain"/></ReactCrop><div className="flex flex-wrap gap-2"><Button disabled={busy||crop.width===0||crop.height===0} onClick={save}><Crop className="mr-2 h-4 w-4"/>Save crop</Button><Button variant="outline" onClick={()=>setCrop({unit:'%',x:0,y:0,width:100,height:100})} title="Reset crop"><RotateCcw className="h-4 w-4"/></Button><Button variant="ghost" onClick={onCancel}>Cancel</Button></div></div>;
}
