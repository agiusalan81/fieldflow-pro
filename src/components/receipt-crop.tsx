import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Crop,Maximize,RotateCcw,RotateCw,Wand2} from 'lucide-react';
import {detectQuadInImage,FULL_QUAD,isFullQuad,warpQuad,type Quad} from '@/lib/quad-crop';
import {toast} from 'sonner';

async function rotated(url:string,dir:1|-1):Promise<Blob>{
 const img=new Image();img.src=url;await img.decode();
 const c=document.createElement('canvas');c.width=img.naturalHeight;c.height=img.naturalWidth;const ctx=c.getContext('2d')!;
 ctx.translate(c.width/2,c.height/2);ctx.rotate(dir*Math.PI/2);ctx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);
 return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Could not rotate')),'image/jpeg',0.95));
}

export function ReceiptCrop({file,onSave,onCancel}:{file:File;onSave:(file:File)=>void;onCancel:()=>void}){
 const [blob,setBlob]=useState<Blob>(file),[url,setUrl]=useState(''),[quad,setQuad]=useState<Quad>(FULL_QUAD),[busy,setBusy]=useState(false),[drag,setDrag]=useState<number|null>(null);
 const image=useRef<HTMLImageElement>(null),box=useRef<HTMLDivElement>(null);
 useEffect(()=>{const u=URL.createObjectURL(blob);setUrl(u);return()=>URL.revokeObjectURL(u);},[blob]);
 const detect=(announce:boolean)=>{const img=image.current;if(!img)return;const q=detectQuadInImage(img);setQuad(q);
  if(announce){if(isFullQuad(q))toast.info('Could not find the receipt edges — drag the corners onto the receipt.');else toast.success('Receipt edges found');}};
 const move=(e:React.PointerEvent)=>{if(drag===null||!box.current)return;const r=box.current.getBoundingClientRect();
  const x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),y=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));
  setQuad(q=>q.map((p,i)=>i===drag?{x,y}:p) as Quad);};
 const save=async()=>{const img=image.current;if(!img)return;setBusy(true);try{
  await new Promise(r=>setTimeout(r,20));const canvas=warpQuad(img,quad);
  const out=await new Promise<Blob>((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Could not crop receipt')),'image/jpeg',0.92));
  onSave(new File([out],file.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}));
 }catch(e){toast.error(e instanceof Error?e.message:'Could not crop receipt');}finally{setBusy(false);}};
 const rotate=async(dir:1|-1)=>{try{setBlob(await rotated(url,dir));}catch{toast.error('Could not rotate photo');}};
 const pts=quad.map(p=>`${p.x*100},${p.y*100}`).join(' ');
 return <div className="space-y-3">
  <p className="text-sm text-muted-foreground">Drag the four corners onto the receipt edges. It will be straightened when saved.</p>
  <div className="flex justify-center"><div ref={box} className="relative inline-block touch-none select-none" onPointerMove={move} onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)}>
   <img ref={image} src={url} alt="Receipt to crop" draggable={false} className="block max-h-[60dvh] w-auto max-w-full object-contain" onLoad={()=>detect(false)}/>
   <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
    <path d={`M0,0H100V100H0Z M${pts.replace(/ /g,' L')}Z`} fillRule="evenodd" className="fill-foreground/40"/>
    <polygon points={pts} vectorEffect="non-scaling-stroke" className="fill-none stroke-primary" strokeWidth={2.5}/>
   </svg>
   {quad.map((p,i)=><button key={i} type="button" aria-label={`Move corner ${i+1}`} onPointerDown={e=>{e.preventDefault();setDrag(i);}}
    className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{left:`${p.x*100}%`,top:`${p.y*100}%`}}>
    <span className={`h-6 w-6 rounded-full border-[3px] border-primary bg-background/70 shadow ${drag===i?'scale-125':''}`}/></button>)}
  </div></div>
  <div className="flex flex-wrap gap-2">
   <Button disabled={busy} onClick={save}><Crop className="mr-2 h-4 w-4"/>{busy?'Straightening…':'Straighten & save'}</Button>
   <Button variant="outline" disabled={busy} onClick={()=>detect(true)}><Wand2 className="mr-2 h-4 w-4"/>Auto detect</Button>
   <Button variant="outline" disabled={busy} onClick={()=>setQuad(FULL_QUAD)}><Maximize className="mr-2 h-4 w-4"/>Full photo</Button>
   <Button variant="outline" size="icon" disabled={busy} onClick={()=>rotate(-1)} aria-label="Rotate left"><RotateCcw className="h-4 w-4"/></Button>
   <Button variant="outline" size="icon" disabled={busy} onClick={()=>rotate(1)} aria-label="Rotate right"><RotateCw className="h-4 w-4"/></Button>
   <Button variant="ghost" onClick={onCancel}>Cancel</Button>
  </div></div>;
}
