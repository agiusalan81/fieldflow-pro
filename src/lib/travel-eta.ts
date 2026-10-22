/** Travel distance/ETA rules shared by Start travel, the in-transit badge and the client "on my way" message. */
export type LatLng = { lat: number; lng: number };
/** Straight lines under-read real roads; Malta streets average roughly this factor and speed. */
export const ROAD_FACTOR = 1.3;
export const FALLBACK_KMH = 30;

export function haversineKm(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(Math.max(0, 1 - d)));
}
/** Offline estimate when no road route is available. Never less than 1 minute. */
export function fallbackEta(from: LatLng, to: LatLng) {
  const km = haversineKm(from, to) * ROAD_FACTOR;
  return { km, minutes: Math.max(1, Math.round((km / FALLBACK_KMH) * 60)) };
}
/** Client-facing window, e.g. "approximately 12 minutes (3.4 km)". */
export function etaText(eta: { km: number; minutes: number } | null) {
  if (!eta) return "";
  const m = Math.max(1, Math.round(eta.minutes));
  const t = m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} minute${m === 1 ? "" : "s"}`;
  return `approximately ${t} (${eta.km.toFixed(1)} km)`;
}
export function etaBadge(eta: { km: number; minutes: number } | null) {
  return eta ? `~${Math.max(1, Math.round(eta.minutes))} min · ${eta.km.toFixed(1)} km` : "";
}

/** Browser-only: current GPS, site geocode (OpenStreetMap) and road route (OSRM), falling back to a straight-line estimate. */
export async function currentPosition(timeout = 8000): Promise<LatLng | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((res) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout, maximumAge: 30000 }));
}
const geoCache = new Map<string, LatLng | null>();
export async function geocode(address: string): Promise<LatLng | null> {
  if (geoCache.has(address)) return geoCache.get(address) ?? null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(6000) });
    const j = (await r.json()) as { lat: string; lon: string }[];
    const v = j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
    geoCache.set(address, v);
    return v;
  } catch { return null; }
}
export async function travelEta(from: LatLng, address: string) {
  const to = await geocode(address);
  if (!to) return null;
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`, { signal: AbortSignal.timeout(6000) });
    const j = (await r.json()) as { routes?: { distance: number; duration: number }[] };
    const route = j.routes?.[0];
    if (route) return { km: route.distance / 1000, minutes: Math.max(1, Math.round(route.duration / 60)) };
  } catch { /* fall back */ }
  return fallbackEta(from, to);
}
