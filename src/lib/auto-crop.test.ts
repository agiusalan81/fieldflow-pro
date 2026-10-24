import { describe, it, expect } from 'vitest';
import { detectReceiptBounds } from './auto-crop';
const img = (w: number, h: number, r: { x: number; y: number; w: number; h: number }) => {
  const g = new Array(w * h).fill(30);
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y * w + x] = 240;
  return g;
};
describe('receipt autocrop', () => {
  it('fits a bright receipt on a dark table with a 2% margin', () => {
    const b = detectReceiptBounds(img(100, 100, { x: 30, y: 10, w: 40, h: 80 }), 100, 100);
    expect(b.x).toBeCloseTo(28); expect(b.y).toBeCloseTo(8);
    expect(b.width).toBeCloseTo(44); expect(b.height).toBeCloseTo(84);
  });
  it('keeps the full photo when nothing stands out', () => {
    expect(detectReceiptBounds(new Array(10000).fill(100), 100, 100)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});
