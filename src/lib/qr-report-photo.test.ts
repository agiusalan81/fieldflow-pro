import { describe, it, expect } from 'vitest';
import { validateQrPhoto, QR_PHOTO_LIMIT } from './qr-report-photo';
describe('QR photo limits', () => {
  it('accepts JPEG signatures only', () => { expect(() => validateQrPhoto(new Uint8Array([255,216,255,1]))).not.toThrow(); expect(() => validateQrPhoto(new Uint8Array([137,80,78,71]))).toThrow(); });
  it('rejects oversized uploads', () => { const bytes = new Uint8Array(QR_PHOTO_LIMIT+1); bytes.set([255,216,255]); expect(() => validateQrPhoto(bytes)).toThrow(); });
});