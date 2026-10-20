import { documentLabel, visibleBlocks } from "./documents";
import type { PdfSheetData } from "./service-sheet";
import { pdfFonts, pdfPageDecoration } from "./branding-assets";

export async function buildServicePdf(d: PdfSheetData) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const { font, bold } = await pdfFonts(doc, d.template);
  const decorate = await pdfPageDecoration(doc, d.template);
  const W = 595, H = 842, M = 36, width = W - M * 2;
  const hex = d.template.primaryColor;
  const textHex = d.template.fieldText ?? "#202020";
  const ink = rgb(parseInt(textHex.slice(1,3),16)/255,parseInt(textHex.slice(3,5),16)/255,parseInt(textHex.slice(5,7),16)/255);
  const brand = rgb(parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255);
  let page = doc.addPage([W,H]); let y = H-M;
  decorate(page);
  const safe = (value: string) => value.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/•/g,"-").replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g,"?");
  const wrap = (value: string, w: number, size = 9) => {
    const lines: string[] = [];
    for (const para of safe(value || "-").split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        if (font.widthOfTextAtSize(word, size) > w) {
          if (line) { lines.push(line); line = ""; }
          let chunk = "";
          for (const char of word) { if (font.widthOfTextAtSize(chunk + char,size)>w && chunk) { lines.push(chunk); chunk=""; } chunk+=char; }
          line = chunk;
        } else if (font.widthOfTextAtSize(`${line} ${word}`.trim(),size)>w && line) { lines.push(line); line=word; }
        else line=`${line} ${word}`.trim();
      }
      lines.push(line);
    }
    return lines;
  };
  const newPage = () => { page=doc.addPage([W,H]); decorate(page); y=H-M; };
  const need = (h: number) => { if (y-h<M) newPage(); };
  const text = (value: string,x: number,atY: number,size=9,strong=false) => page.drawText(safe(value),{x,y:atY,size,font:strong?bold:font,color:ink});
  const line = (x1: number,y1: number,x2: number,y2: number) => page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:0.5,color:brand});
  const fieldHex = d.template.fieldBackground ?? "#ffffff";
  const fieldColor = rgb(parseInt(fieldHex.slice(1,3),16)/255,parseInt(fieldHex.slice(3,5),16)/255,parseInt(fieldHex.slice(5,7),16)/255);
  const para = (value: string) => { for(const valueLine of wrap(value,width)) { need(13); page.drawRectangle({x:M,y:y-3,width,height:13,color:fieldColor}); text(valueLine,M,y); y-=13; } };
  const label = (value: string) => { need(35); y-=8; text(value.toUpperCase(),M,y,8,true); y-=14; };
  const image = async (data: string | null | undefined,x: number,top: number,w: number,h: number) => {
    if (!data?.startsWith("data:image/")) return;
    try { const img = data.startsWith("data:image/png") ? await doc.embedPng(data) : await doc.embedJpg(data); const scale=Math.min(w/img.width,h/img.height); page.drawImage(img,{x:x+(w-img.width*scale)/2,y:top-img.height*scale,width:img.width*scale,height:img.height*scale}); } catch { /* Invalid optional image must not prevent delivery. */ }
  };
  const headerLeft = wrap([d.company,d.officeAddress,d.vatNumber && `VAT / Tax: ${d.vatNumber}`].filter(Boolean).join("\n"),width/3-10);
  const headerRight = wrap(d.contact || "",width/3-10);
  const headerHeight = Math.max(65,Math.max(headerLeft.length,headerRight.length)*12+10);
  headerLeft.forEach((v,i)=>text(v,M,y-i*12,9,i===0));
  headerRight.forEach((v,i)=>text(v,M+width*2/3+10,y-i*12,8));
  await image(d.logo,M+width/3,y,width/3,55);
  y-=headerHeight; line(M,y,W-M,y); y-=20;
  text(`Job sheet- ${d.number}`,M,y,12,true); text(d.date,W-M-font.widthOfTextAtSize(safe(d.date),9),y); y-=20;
  if(d.template.header) { para(d.template.header); y-=5; }
  const visible=visibleBlocks(d.template);
  const fields: Record<string,string>={client:d.client,address:d.address,equipment:[d.asset,d.workType].filter(Boolean).join("\n"),fault:d.fault,work:d.repairs,notes:d.notes || ""};
  const table = (headers: string[], rows: string[][], ratios: number[]) => {
    const widths=ratios.map(r=>r*width);
    const drawRow=(cells:string[],head=false) => {
      const wrapped=cells.map((v,i)=>wrap(v,widths[i] ? widths[i]-10 : 40,8));
      const max=Math.max(1,...wrapped.map(v=>v.length));
      for(let offset=0;offset<max;) {
        if(y-25<M) { newPage(); if(!head) drawRow(headers,true); }
        const count=Math.min(max-offset,Math.max(1,Math.floor((y-M-10)/11)));
        const h=count*11+10; let x=M; page.drawRectangle({x:M,y:y-h,width,height:h,color:fieldColor}); line(M,y,W-M,y);
        wrapped.forEach((values,i)=>{line(x,y,x,y-h);values.slice(offset,offset+count).forEach((v,j)=>text(v,x+5,y-13-j*11,8,head));x+=widths[i] ?? 0;});
        line(W-M,y,W-M,y-h);line(M,y-h,W-M,y-h);y-=h;offset+=count;
      }
    };
    need(50);drawRow(headers,true);for(const row of rows)drawRow(row);
  };
  for(const key of visible) {
    if(key==="notes" && !d.notes)continue;
    if(key==="timesheet") {
      label(documentLabel(d.template,key));
      const travel=d.template.showTravel;
      table(travel?["Date","In","Out","Travel h","Techs","Hours"]:["Date","In","Out","Techs","Hours"],d.logs.map(l=>[l.date,l.in,l.out,...(travel?[l.travel.toFixed(2)]:[]),`${l.count}: ${l.techs}`,l.total.toFixed(2)]),travel?[.19,.11,.11,.14,.3,.15]:[.2,.13,.13,.36,.18]);
    } else if(key==="parts") {label(documentLabel(d.template,key));table(["Description","Unit","Qty"],d.parts.map(p=>[p.desc,p.unit,String(p.qty)]),[.74,.13,.13]);}
    else if(key==="signoff") {
      need(115);y-=10;const top=y;const col=width/2;line(M,y,W-M,y);text(documentLabel(d.template,"technician").toUpperCase(),M+8,y-15,8,true);text(documentLabel(d.template,"client_name").toUpperCase(),M+col+8,y-15,8,true);
      wrap(d.technician,col-16).forEach((v,i)=>text(v,M+8,top-30-i*11));wrap(`${d.signedBy || "-"}${d.idCard ? ` - ID ${d.idCard}` : ""}`,col-16).forEach((v,i)=>text(v,M+col+8,top-30-i*11));
      await image(d.technicianSignature,M+8,top-48,col-16,50);await image(d.signature,M+col+8,top-48,col-16,50);y-=105;line(M,y,W-M,y);line(M+col,top,M+col,y);
    } else {label(documentLabel(d.template,key));para(fields[key] || "-");}
  }
  if(d.terms){label("Terms & conditions");for(const term of d.terms.split("\n").filter(v=>v.trim()))para(`- ${term.replace(/^\s*[-•]\s*/,"")}`);}
  if(d.template.footer){label("");para(d.template.footer);}
  return doc.save();
}