import { PDFDocument } from 'pdf-lib';
export async function photosToPdf(files: File[]): Promise<Blob> {
  if (!files.length) throw new Error('Add at least one photo.');
  const pdf=await PDFDocument.create();
  for(const file of files){
    if(!file.type.startsWith('image/')) throw new Error('Choose photos only.');
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo processing unavailable.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not process photo.')),'image/jpeg',0.86));
    const image=await pdf.embedJpg(await blob.arrayBuffer());const page=pdf.addPage([595,842]);
    const fit=Math.min(555/image.width,802/image.height);page.drawImage(image,{x:(595-image.width*fit)/2,y:(842-image.height*fit)/2,width:image.width*fit,height:image.height*fit});
  }
  return new Blob([new Uint8Array(await pdf.save())],{type:'application/pdf'});
}
export async function pdfEngine(){const pdfjs=await import('pdfjs-dist'); const {default:worker}=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker;return pdfjs;}
export async function indexPdf(blob:Blob){
 const engine=await pdfEngine();const loading=engine.getDocument({data:new Uint8Array(await blob.arrayBuffer())});const pdf=await loading.promise;
 const pages=[];for(let page=1;page<=pdf.numPages;page++){const p=await pdf.getPage(page);const content=await p.getTextContent();pages.push({page,text:content.items.map(i=>'str'in i?i.str:'').join(' ')});}
 const count=pdf.numPages;await loading.destroy();return {pages,count};
}
