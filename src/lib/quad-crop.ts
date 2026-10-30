// CamScanner-style receipt detection: four corners (fractions 0..1) and a perspective straighten.
export type Pt = { x: number; y: number };
export type Quad = [Pt, Pt, Pt, Pt]; // TL, TR, BR, BL
export const FULL_QUAD: Quad = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];

function otsu(g: ArrayLike<number>): number {
  const hist = new Array(256).fill(0); for (let i=0;i<g.length;i++) hist[Math.round(g[i] ?? 0)]++;
  let sum=0; for(let t=0;t<256;t++) sum+=t*hist[t];
  let sB=0,wB=0,best=0,at=128;
  for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=g.length-wB;if(!wF)break;sB+=t*hist[t];
    const d=wB*wF*(sB/wB-(sum-sB)/wF)**2;if(d>best){best=d;at=t;}}
  return at;
}

function morph(m: Uint8Array, w: number, h: number, r: number, dilate: boolean): Uint8Array {
  // separable box min/max
  const tmp=new Uint8Array(w*h), out=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=dilate?0:1;for(let k=-r;k<=r;k++){const xx=x+k;if(xx<0||xx>=w)continue;const p=m[y*w+xx]??0;v=dilate?(v|p):(v&p);}tmp[y*w+x]=v;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=dilate?0:1;for(let k=-r;k<=r;k++){const yy=y+k;if(yy<0||yy>=h)continue;const p=tmp[yy*w+x]??0;v=dilate?(v|p):(v&p);}out[y*w+x]=v;}
  return out;
}

/** Finds the paper as one solid bright shape (gaps from print/creases closed) and returns its four corners; fails safe to the full photo. */
export function detectQuad(gray: ArrayLike<number>, w: number, h: number): Quad {
  if (w<16||h<16||gray.length!==w*h) return FULL_QUAD;
  let lo=255,hi=0; for(let i=0;i<gray.length;i++){const v=gray[i]??0;lo=Math.min(lo,v);hi=Math.max(hi,v);}
  if(hi-lo<25) return FULL_QUAD;
  const t=otsu(gray); let mask: Uint8Array=new Uint8Array(w*h); for(let i=0;i<w*h;i++) mask[i]=(gray[i]??0)>t?1:0;
  const r=Math.max(2,Math.round(Math.max(w,h)/60));
  mask=morph(morph(mask,w,h,r,true),w,h,r,false); // close text, creases, shadows
  mask=morph(morph(mask,w,h,1,false),w,h,1,true); // drop speckles
  const seen=new Uint8Array(w*h); let best: {count:number;px:number[]}|undefined;
  for(let s=0;s<w*h;s++){ if(!mask[s]||seen[s])continue; const q=[s]; seen[s]=1; let border=0;
    for(let i=0;i<q.length;i++){const p=q[i]!,x=p%w,y=(p-x)/w; if(x===0||y===0||x===w-1||y===h-1)border++;
      if(x>0&&mask[p-1]&&!seen[p-1]){seen[p-1]=1;q.push(p-1);} if(x<w-1&&mask[p+1]&&!seen[p+1]){seen[p+1]=1;q.push(p+1);}
      if(y>0&&mask[p-w]&&!seen[p-w]){seen[p-w]=1;q.push(p-w);} if(y<h-1&&mask[p+w]&&!seen[p+w]){seen[p+w]=1;q.push(p+w);} }
    if(q.length<w*h*0.08||q.length>w*h*0.96) continue;
    if(border>(w+h)*2*0.5) continue; // background, not paper
    if(!best||q.length>best.count) best={count:q.length,px:q};
  }
  if(!best) return FULL_QUAD;
  let tl=0,tr=0,br=0,bl=0,mTl=Infinity,mTr=-Infinity,mBr=-Infinity,mBl=Infinity;
  for(const p of best.px){const x=p%w,y=(p-x)/w,s=x+y,d=x-y;
    if(s<mTl){mTl=s;tl=p;} if(s>mBr){mBr=s;br=p;} if(d>mTr){mTr=d;tr=p;} if(d<mBl){mBl=d;bl=p;}}
  const pt=(p:number):Pt=>({x:(p%w+0.5)/w,y:(Math.floor(p/w)+0.5)/h});
  let quad:Quad=[pt(tl),pt(tr),pt(br),pt(bl)];
  const area=polyArea(quad)*w*h;
  if(area<w*h*0.08||best.count/area<0.75) return FULL_QUAD; // not a clean four-sided sheet
  const cx=quad.reduce((a,p)=>a+p.x,0)/4, cy=quad.reduce((a,p)=>a+p.y,0)/4;
  quad=quad.map(p=>({x:clamp(cx+(p.x-cx)*1.03),y:clamp(cy+(p.y-cy)*1.03)})) as Quad; // small safety margin
  return quad;
}
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
export function polyArea(q: Pt[]): number { let a=0; for(let i=0;i<q.length;i++){const p=q[i]!,n=q[(i+1)%q.length]!;a+=p.x*n.y-n.x*p.y;} return Math.abs(a)/2; }
export const isFullQuad=(q:Quad)=>q.every((p,i)=>Math.abs(p.x-FULL_QUAD[i]!.x)<1e-6&&Math.abs(p.y-FULL_QUAD[i]!.y)<1e-6);

/** Homography mapping unit square (u,v) → quad points. */
export function squareToQuad(q: [Pt,Pt,Pt,Pt]): (u:number,v:number)=>Pt {
  const [p0,p1,p2,p3]=q; const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dy1=p1.y-p2.y,dy2=p3.y-p2.y;
  const sx=p0.x-p1.x+p2.x-p3.x, sy=p0.y-p1.y+p2.y-p3.y; let g=0,hh=0;
  if(Math.abs(sx)>1e-12||Math.abs(sy)>1e-12){const den=dx1*dy2-dx2*dy1; g=(sx*dy2-dx2*sy)/den; hh=(dx1*sy-sx*dy1)/den;}
  const a=p1.x-p0.x+g*p1.x, b=p3.x-p0.x+hh*p3.x, c=p0.x, d=p1.y-p0.y+g*p1.y, e=p3.y-p0.y+hh*p3.y, f=p0.y;
  return (u,v)=>{const z=g*u+hh*v+1;return {x:(a*u+b*v+c)/z,y:(d*u+e*v+f)/z};};
}
const dist=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Output size in pixels for a quad given in source pixel coordinates. */
export function outputSize(q: Quad, max=2400): {w:number;h:number} {
  let w=Math.max(dist(q[0],q[1]),dist(q[3],q[2])), h=Math.max(dist(q[0],q[3]),dist(q[1],q[2]));
  const s=Math.min(1,max/Math.max(w,h)); return {w:Math.max(1,Math.round(w*s)),h:Math.max(1,Math.round(h*s))};
}

function grayOf(img: CanvasImageSource, nw: number, nh: number, size=360) {
  const s=Math.min(1,size/Math.max(nw,nh)), w=Math.max(1,Math.round(nw*s)), h=Math.max(1,Math.round(nh*s));
  const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d',{willReadFrequently:true});
  if(!ctx) return null; ctx.filter='blur(1px)'; ctx.drawImage(img,0,0,w,h);
  const d=ctx.getImageData(0,0,w,h).data, g=new Uint8ClampedArray(w*h);
  for(let i=0;i<w*h;i++) g[i]=((d[i*4]??0)*299+(d[i*4+1]??0)*587+(d[i*4+2]??0)*114)/1000;
  return {g,w,h};
}
export function detectQuadInImage(img: HTMLImageElement): Quad {
  const r=grayOf(img,img.naturalWidth,img.naturalHeight); return r?detectQuad(r.g,r.w,r.h):FULL_QUAD;
}

/** Straightens the quad (fractions) of img into an upright JPEG canvas. */
export function warpQuad(img: HTMLImageElement, quad: Quad): HTMLCanvasElement {
  const W=img.naturalWidth,H=img.naturalHeight; const src=document.createElement('canvas'); src.width=W; src.height=H;
  const sctx=src.getContext('2d',{willReadFrequently:true})!; sctx.drawImage(img,0,0);
  const px=quad.map(p=>({x:p.x*W,y:p.y*H})) as Quad; const {w,h}=outputSize(px);
  const sd=sctx.getImageData(0,0,W,H).data, out=document.createElement('canvas'); out.width=w; out.height=h;
  const octx=out.getContext('2d')!, od=octx.createImageData(w,h), map=squareToQuad(px);
  for(let y=0;y<h;y++){const v=(y+0.5)/h; for(let x=0;x<w;x++){const p=map((x+0.5)/w,v);
    const fx=Math.min(W-1.001,Math.max(0,p.x-0.5)), fy=Math.min(H-1.001,Math.max(0,p.y-0.5)), x0=fx|0, y0=fy|0, ax=fx-x0, ay=fy-y0;
    const i00=(y0*W+x0)*4,i10=i00+4,i01=i00+W*4,i11=i01+4,o=(y*w+x)*4;
    for(let k=0;k<3;k++) od.data[o+k]=(sd[i00+k]!*(1-ax)+sd[i10+k]!*ax)*(1-ay)+(sd[i01+k]!*(1-ax)+sd[i11+k]!*ax)*ay;
    od.data[o+3]=255;}}
  octx.putImageData(od,0,0); return out;
}
