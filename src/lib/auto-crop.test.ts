import { describe, it, expect } from 'vitest';
import { detectReceiptBounds } from './auto-crop';
const img = (w: number, h: number, r: { x: number; y: number; w: number; h: number }, bg = 30, fg = 240, noise = 0) => {
  const g = Array.from({ length: w * h }, (_, i) => Math.max(0, Math.min(255, bg + (noise ? ((i * 7919) % (noise * 2)) - noise : 0))));
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y * w + x] = fg;
  return g;
};
describe('receipt autocrop', () => {
  it('fits a bright receipt on a dark table with a 2% margin', () => {
    const b = detectReceiptBounds(img(100, 100, { x: 30, y: 10, w: 40, h: 80 }), 100, 100);
    expect(b.x).toBeCloseTo(28); expect(b.y).toBeCloseTo(8);
    expect(b.width).toBeCloseTo(44); expect(b.height).toBeCloseTo(84);
  });
  it('still finds the receipt on a textured, mid-grey desk', () => {
    const b = detectReceiptBounds(img(100, 100, { x: 20, y: 15, w: 50, h: 70 }, 120, 230, 40), 100, 100);
    expect(b.x).toBeCloseTo(18); expect(b.y).toBeCloseTo(13);
    expect(b.width).toBeCloseTo(54); expect(b.height).toBeCloseTo(74);
  });
  it('keeps the full photo when nothing stands out', () => {
    expect(detectReceiptBounds(new Array(10000).fill(100), 100, 100)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});
