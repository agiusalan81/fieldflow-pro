import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {FileText} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {pdfEngine} from '@/lib/pdf-tools';

/** Private, account-scoped previews; nothing is persisted or made public. */
export function ReceiptThumbnail({userId,path,blob}:{userId:string;path:string;blob?:Blob}) {
  const host=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false);
  useEffect(()=>{const element=host.current;if(!element)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'100px'});observer.observe(element);return()=>observer.disconnect();},[]);
  const preview=useQuery({queryKey:['receipt-thumbnail',userId,path,blob],enabled:visible,staleTime:5*60_000,gcTime:5*60_000,retry:false,queryFn:async()=>{
    let source=blob;
    if(!source){const result=await supabase.storage.from('job-receipts').download(path);if(result.error)throw result.error;source=result.data;}
    if(!source)throw new Error('Receipt unavailable');
    const engine=await pdfEngine(),loading=engine.getDocument({data:new Uint8Array(await source.arrayBuffer())});
    try {const doc=await loading.promise,page=await doc.getPage(1),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:160/base.width});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const context=canvas.getContext('2d');if(!context)throw new Error('Preview unavailable');
      await page.render({canvasContext:context,viewport}).promise;return canvas.toDataURL('image/jpeg',0.8);
    }finally{await loading.destroy();}
  }});
  return <span ref={host} className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-document-paper" aria-label={preview.isError?'Receipt preview unavailable':'Receipt preview'}>{preview.data?<img src={preview.data} alt="Receipt first page" className="h-full w-full object-contain"/>:<FileText className="h-5 w-5 text-muted-foreground"/>}</span>;
}