import { describe, expect, it, vi, afterEach } from 'vitest';
import { confirmFieldLocation, fieldDeviceReady, requiresFieldDevice } from './field-device';
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
describe('field sign-in requirements', () => {
  it.each(['technician','supervisor','maintenance'])('requires both permissions for real %s', role => expect(requiresFieldDevice(role)).toBe(true));
  it('does not require office-only staff but includes office field workers', () => {
    expect(requiresFieldDevice('admin')).toBe(false);
    expect(requiresFieldDevice('admin',true)).toBe(true);
  });
  it('requires a registered notification subscription and actual location', () => {
    expect(fieldDeviceReady('registered','granted')).toBe(true);
    expect(fieldDeviceReady('registered','prompt')).toBe(false);
    expect(fieldDeviceReady('unsupported','granted')).toBe(false);
    expect(fieldDeviceReady('error','granted')).toBe(false);
    expect(fieldDeviceReady('registered','unsupported')).toBe(false);
  });
  it('records account consent only after an actual GPS fix', async () => {
    vi.stubGlobal('navigator',{ geolocation:{ getCurrentPosition:(success: () => void) => success() }});
    expect(await confirmFieldLocation('field-1')).toBe('granted');
    expect(localStorage.getItem('location-consent:field-1')).toBe('yes');
  });
  it('does not accept denied GPS', async () => {
    vi.stubGlobal('navigator',{ geolocation:{ getCurrentPosition:(_: unknown, fail: (e:{code:number})=>void) => fail({code:1}) }});
    expect(await confirmFieldLocation('field-1')).toBe('denied');
    expect(localStorage.getItem('location-consent:field-1')).toBeNull();
  });
});