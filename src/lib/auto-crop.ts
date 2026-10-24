export type CropBox = { x: number; y: number; width: number; height: number }; // percentages
export const FULL_CROP: CropBox = { x: 0, y: 0, width: 100, height: 100 };

/** Otsu threshold: splits the photo into paper and background brightness. */
function otsu(gray: ArrayLike<number>): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[Math.round(gray[i]!)]++;
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

/** Longest run of indices whose density passes the threshold, tolerating small gaps (text lines, folds). */
function longestRun(density: number[], min: number): [number, number] | null {
  let best: [number, number] | null = null, start = -1, gap = 0;
  const tolerance = Math.max(2, Math.round(density.length * 0.03));
  for (let i = 0; i <= density.length; i++) {
    const hit = i < density.length && density[i]! >= min;
    if (hit) { if (start < 0) start = i; gap = 0; continue; }
    if (start < 0) continue;
    if (i < density.length && ++gap <= tolerance) continue;
    const end = i - gap - (i < density.length ? 0 : 0);
    const e = Math.max(start, Math.min(end, density.length - 1));
    if (!best || e - start > best[1] - best[0]) best = [start, e];
    start = -1; gap = 0;
  }
  return best;
}

/**
 * Finds the receipt as the largest bright paper area (falls back to darker-on-light when the paper is darker
 * than its surroundings). Returns a percent crop with a 2% margin, or the full photo when unsure.
 */
export function detectReceiptBounds(gray: Uint8ClampedArray | number[], w: number, h: number): CropBox {
  if (w < 8 || h < 8) return FULL_CROP;
  const t = otsu(gray);
  // Paper is whichever class the photo's centre mostly belongs to.
  let centreBright = 0, centre = 0;
  for (let y = Math.floor(h * 0.35); y < h * 0.65; y++) for (let x = Math.floor(w * 0.35); x < w * 0.65; x++) { centre++; if (gray[y * w + x]! > t) centreBright++; }
  const paperBright = centreBright >= centre / 2;
  const paper = (i: number) => (gray[i]! > t) === paperBright;
  const rows = Array.from({ length: h }, (_, y) => { let n = 0; for (let x = 0; x < w; x++) if (paper(y * w + x)) n++; return n / w; });
  const rowRun = longestRun(rows, 0.25); if (!rowRun) return FULL_CROP;
  const cols = Array.from({ length: w }, (_, x) => { let n = 0; for (let y = rowRun[0]; y <= rowRun[1]; y++) if (paper(y * w + x)) n++; return n / (rowRun[1] - rowRun[0] + 1); });
  const colRun = longestRun(cols, 0.4); if (!colRun) return FULL_CROP;
  const [top, bottom] = rowRun, [left, right] = colRun;
  const m = 0.02;
  const x0 = Math.max(0, left / w - m), y0 = Math.max(0, top / h - m);
  const x1 = Math.min(1, (right + 1) / w + m), y1 = Math.min(1, (bottom + 1) / h + m);
  const box = { x: x0 * 100, y: y0 * 100, width: (x1 - x0) * 100, height: (y1 - y0) * 100 };
  if (box.width * box.height < 600) return FULL_CROP; // under 6% of the photo: unreliable
  return box;
}

export function autoCropImage(img: HTMLImageElement): CropBox {
  const scale = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return FULL_CROP;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = (d[i * 4]! * 299 + d[i * 4 + 1]! * 587 + d[i * 4 + 2]! * 114) / 1000;
  return detectReceiptBounds(gray, w, h);
}
