export type CropBox = { x: number; y: number; width: number; height: number }; // percentages
export const FULL_CROP: CropBox = { x: 0, y: 0, width: 100, height: 100 };

/** Otsu threshold: splits the photo into paper and background brightness. */
function otsu(gray: ArrayLike<number>): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[Math.round((gray[i] ?? 0))]++;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, at = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = gray.length - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; at = t; }
  }
  return at;
}

/** Select a connected paper surface, not a global row density (which misses narrow/off-centre receipts). */
export function detectReceiptBounds(gray: Uint8ClampedArray | number[], w: number, h: number): CropBox {
  if (w < 8 || h < 8 || gray.length !== w * h) return FULL_CROP;
  let low = 255, high = 0;
  for (const value of gray) { low = Math.min(low, value); high = Math.max(high, value); }
  if (high - low < 18) return FULL_CROP;
  const threshold = otsu(gray);
  let best: {score: number; left: number; right: number; top: number; bottom: number} | undefined;
  for (const bright of [true, false]) {
    const visited = new Uint8Array(w * h);
    for (let seed = 0; seed < gray.length; seed++) {
      if (visited[seed] || ((gray[seed] ?? 0) > threshold) !== bright) continue;
      const queue = [seed]; visited[seed] = 1;
      let left=w, right=0, top=h, bottom=0, count=0, border=0;
      for (let at=0; at<queue.length; at++) {
        const index=queue[at]; if (index === undefined) continue;
        const x=index%w, y=Math.floor(index/w); count++;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        if(x===0||x===w-1||y===0||y===h-1)border++;
        for(const next of [x>0?index-1:-1,x<w-1?index+1:-1,y>0?index-w:-1,y<h-1?index+w:-1]) {
          if(next<0||visited[next]||((gray[next] ?? 0)>threshold)!==bright)continue;
          visited[next]=1;queue.push(next);
        }
      }
      const area=(right-left+1)*(bottom-top+1), fill=count/area;
      // A background surrounds the image; small text/shadows are not paper.
      if(count<w*h*0.06||fill<0.45||area>w*h*0.97||border>2*(w+h)*0.3)continue;
      const score=count*fill/(1+border);
      if(!best||score>best.score)best={score,left,right,top,bottom};
    }
  }
  if(!best)return FULL_CROP;
  const x0=Math.max(0,best.left/w-0.02), y0=Math.max(0,best.top/h-0.02);
  const x1=Math.min(1,(best.right+1)/w+0.02), y1=Math.min(1,(best.bottom+1)/h+0.02);
  return {x:x0*100,y:y0*100,width:(x1-x0)*100,height:(y1-y0)*100};
}

export function autoCropImage(img: HTMLImageElement): CropBox {
  const scale = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return FULL_CROP;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = ((d[i * 4] ?? 0) * 299 + (d[i * 4 + 1] ?? 0) * 587 + (d[i * 4 + 2] ?? 0) * 114) / 1000;
  return detectReceiptBounds(gray, w, h);
}
