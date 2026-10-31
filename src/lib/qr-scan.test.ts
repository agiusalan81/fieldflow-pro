import { expect, it } from 'vitest';
import { scannedTarget } from './qr-scan';
const origin = 'https://fieldbridgeapp.com';
it('accepts printed references and technical asset QR codes', () => {
  expect(scannedTarget('FR-01', origin)).toEqual({ kind: 'reference', reference: 'FR-01' });
  expect(scannedTarget(`${origin}/auth?equipment=12345678-1234-1234-1234-123456789abc`, origin)).toEqual({ kind: 'asset', id: '12345678-1234-1234-1234-123456789abc' });
});
it('accepts existing hotel and retail report tokens', () => {
  expect(scannedTarget(`https://www.aisleopsapp.com/store-report/${'a'.repeat(64)}`, origin)).toEqual({ kind: 'store-report', token: 'a'.repeat(64) });
  expect(scannedTarget(`https://fieldbridgehotels.com/problem/${'b'.repeat(64)}`, origin)?.kind).toBe('problem');
});
it('rejects unrelated URLs, executable schemes and malformed tokens', () => {
  expect(scannedTarget('https://evil.example/auth?equipment=12345678-1234-1234-1234-123456789abc', origin)).toBeNull();
  expect(scannedTarget('javascript:alert(1)', origin)).toBeNull();
  expect(scannedTarget(`${origin}/problem/invalid`, origin)).toBeNull();
});