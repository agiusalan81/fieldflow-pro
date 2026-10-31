export type ScannedTarget = { kind: 'reference'; reference: string } | { kind: 'asset'; id: string } | { kind: 'problem' | 'store-report'; token: string };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const hosts = ['fieldbridgeapp.com', 'fieldbridgehotels.com', 'aisleopsapp.com', 'fieldbridge.lovable.app'];

export function scannedTarget(raw: string, origin: string): ScannedTarget | null {
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  if (!value.includes('://') && !value.startsWith('/')) {
    return /^[\p{L}\p{N}][\p{L}\p{N} ._/-]{0,119}$/u.test(value) ? { kind: 'reference', reference: value } : null;
  }
  try {
    const url = new URL(value, origin);
    if (url.username || url.password || (url.origin !== origin && (url.protocol !== 'https:' || !hosts.includes(url.hostname.replace(/^www\./, ''))))) return null;
    const id = url.searchParams.get('equipment');
    if (url.pathname === '/auth' && id && uuid.test(id)) return { kind: 'asset', id };
    const asset = url.pathname.match(/^\/equipment\/([^/]+)$/);
    if (asset && uuid.test(asset[1])) return { kind: 'asset', id: asset[1] };
    const report = url.pathname.match(/^\/(problem|store-report)\/([a-f0-9]{64})$/);
    if (report) return { kind: report[1] as 'problem' | 'store-report', token: report[2] };
    return null;
  } catch { return null; }
}