import { EDITION_SPEC, parseEdition } from './editions';

export function inviteSendable(invite: { email: string | null; used_at: string | null; expires_at: string }, now = Date.now()) {
  return Boolean(invite.email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(invite.email) && !invite.used_at && new Date(invite.expires_at).getTime() > now);
}
export function teamInviteDestination(product: { app_url: string; engine_edition: string | null; name: string }, token: string) {
  const edition = parseEdition(product.engine_edition);
  const fallback = edition === 'hotel' ? 'https://fieldbridgehotels.com' : edition === 'retail' ? 'https://aisleopsapp.com' : 'https://fieldbridgeapp.com';
  const url = new URL(product.app_url || fallback);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('The company app address needs a secure website address.');
  return { inviteUrl: `${url.origin}/join/${encodeURIComponent(token)}`, product: product.name || EDITION_SPEC[edition].product };
}