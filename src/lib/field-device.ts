import type { PushStatus } from './web-push';

export type GeoStatus = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unavailable';
export function requiresFieldDevice(role?: string, canFieldDispatch = false) {
  return ['technician', 'supervisor', 'maintenance'].includes(role ?? '') || canFieldDispatch;
}
export function fieldDeviceReady(push: PushStatus | null, geo: GeoStatus | null) {
  return push === 'registered' && geo === 'granted';
}
export async function readLocationPermission(): Promise<GeoStatus> {
  if (!navigator.geolocation) return 'unsupported';
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state; }
  catch { return 'prompt'; }
}
export async function confirmFieldLocation(userId: string): Promise<GeoStatus> {
  if (!navigator.geolocation) return 'unsupported';
  return new Promise(resolve => {
    let settled = false;
    const finish = (status: GeoStatus) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (status === 'granted') {
        localStorage.setItem(`location-consent:${userId}`, 'yes');
        window.dispatchEvent(new Event('location-consent'));
      }
      resolve(status);
    };
    const timer = setTimeout(() => finish('unavailable'), 12000);
    navigator.geolocation.getCurrentPosition(() => finish('granted'), e => finish(e.code === 1 ? 'denied' : 'unavailable'), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  });
}