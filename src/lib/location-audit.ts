import type { FleetPoint } from './fleet';
export const maltaClock = (value: string) => new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Malta',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
export function pointsInRange(points: FleetPoint[], from: string, to: string) {
  if (from > to) return [];
  return points.filter(p => { const time=maltaClock(p.recorded_at); return time>=from && time<=to; }).sort((a,b)=>Date.parse(a.recorded_at)-Date.parse(b.recorded_at));
}