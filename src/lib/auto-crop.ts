export type CropBox = { x: number; y: number; width: number; height: number }; // percentages
const FULL: CropBox = { x: 0, y: 0, width: 100, height: 100 };

/** Finds the receipt by contrast against the photo's border colour. Returns percent crop with a 2% margin. */
export function detectReceiptBounds(gray: Uint8ClampedArray | number[], w: number, h: number): CropBox {
  if (w < 8 || h < 8) return FULL;
  const border: number[] = [];
  for (let x = 0; x < w; x++) { border.push(gray[x]!, gray[(h - 1) * w + x]!); }
  for (let y = 0; y < h; y++) { border.push(gray[y * w]!, gray[y * w + w - 1]!); }
  border.sort((a, b) => a - b);
  const bg = border[Math.floor(border.length / 2)]!;
  const fg = (i: number) => Math.abs(gray[i]! - bg) > 40;
  const rowHit = (y: number) => { let n = 0; for (let x = 0; x < w; x++) if (fg(y * w + x)) n++; return n / w > 0.05; };
  const colHit = (x: number) => { let n = 0; for (let y = 0; y < h; y++) if (fg(y * w + x)) n++; return n / h > 0.05; };
  let top = 0, bottom = h - 1, left = 0, right = w - 1;
  while (top < h && !rowHit(top)) top++;
  while (bottom > top && !rowHit(bottom)) bottom--;
  while (left < w && !colHit(left)) left++;
  while (right > left && !colHit(right)) right--;
  if (top >= bottom || left >= right) return FULL;
  const m = 0.02;
  const x0 = Math.max(0, left / w - m), y0 = Math.max(0, top / h - m);
  const x1 = Math.min(1, (right + 1) / w + m), y1 = Math.min(1, (bottom + 1) / h + m);
  const box = { x: x0 * 100, y: y0 * 100, width: (x1 - x0) * 100, height: (y1 - y0) * 100 };
  if (box.width * box.height < 1000) return FULL; // under 10% of the photo: unreliable
  return box;
}

export function autoCropImage(img: HTMLImageElement): CropBox {
  const scale = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); if (!ctx) return FULL;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = (d[i * 4]! * 299 + d[i * 4 + 1]! * 587 + d[i * 4 + 2]! * 114) / 1000;
  return detectReceiptBounds(gray, w, h);
}
