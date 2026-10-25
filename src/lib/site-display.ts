/** Distinguishes identically named chain sites using the optional branch/store ID and address. */
export type SiteLike = { name: string; address?: string | null; store_code?: string | null };

const code = (s: SiteLike) => (s.store_code?.trim() ? `[#${s.store_code.trim().replace(/^#/, '')}] ` : '');

/** Full reference for dropdowns and recipient previews: "[#104] Costa Coffee — Level 2, Valletta". */
export function formatSiteDisplay(s: SiteLike) {
  const address = s.address?.trim();
  return `${code(s)}${s.name}${address ? ` — ${address}` : ''}`;
}
/** Title line without address: "[#104] Costa Coffee". */
export function formatSiteTitle(s: SiteLike) {
  return `${code(s)}${s.name}`;
}
