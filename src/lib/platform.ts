export const BILLING_CADENCES = ["monthly", "quarterly", "yearly"] as const;
export const DEFAULT_TRIAL_DAYS = 60;
export const COMPANY_PRODUCT_KEY = "fieldbridge";
export const COMPANY_PRODUCT_NAME = "FieldBridge";
export function productLink(appUrl: string, path: string, fallbackOrigin = "") {
  const origin = (appUrl.trim() || fallbackOrigin).replace(/\/+$/, "");
  return `${origin}${path}`;
}
/** Prefer the company app; fallback is safe only when there is one active product. */
export function companyProduct<T extends { slug: string; active: boolean }>(products: T[]): T | null {
  return products.find((p) => p.slug === COMPANY_PRODUCT_KEY && p.active)
    ?? (products.filter((p) => p.active).length === 1 ? products.find((p) => p.active) ?? null : null);
}
export function monthlyEquivalent(price: number, cadence: string) { return price / (cadence === "yearly" ? 12 : cadence === "quarterly" ? 3 : 1); }
export function trialAccess(end: string, now: number) { return new Date(end).getTime() > now; }
export function costPerUser(expenses: number, users: number) { return users > 0 ? expenses / users : null; }
export function estimatePhotoStorage(sheets: number, photosPerSheet = 4, megabytesPerPhoto = 1.2) { return sheets * photosPerSheet * megabytesPerPhoto; }
export function effectiveModules(base: string[], packs: string[][], overrides: { module: string; enabled: boolean; starts_at: string; ends_at: string }[], now: number) {
  const modules = new Set(["core", ...base, ...packs.flat()]);
  for (const o of overrides) if (new Date(o.starts_at).getTime() <= now && new Date(o.ends_at).getTime() > now) { if (o.enabled) modules.add(o.module); else modules.delete(o.module); }
  return [...modules];
}export const PERMANENT_UNTIL = "2099-12-31T23:59:59.000Z";
export const SETUP_REASON = "Setup package";
/** Per-company items charge once; per-user items charge once per user. */
export function packagePrice(items: { price: number; billing_basis: string }[], users: number) {
  return items.reduce((sum, i) => sum + i.price * (i.billing_basis === "per_user" ? Math.max(0, users) : 1), 0);
}
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Monthly = full year / 12; quarterly = discounted year / 4; yearly = discounted year. */
export function cadencePrices(fullYear: number, quarterlyDiscount: number, yearlyDiscount: number) {
  const pct = (d: number) => 1 - Math.min(100, Math.max(0, d)) / 100;
  return { monthly_price: r2(fullYear / 12), quarterly_price: r2(fullYear * pct(quarterlyDiscount) / 4), yearly_price: r2(fullYear * pct(yearlyDiscount)) };
}
/** Recovers the full-year price and discounts from saved prices. */
export function cadenceDiscounts(p: { monthly_price?: number | null; quarterly_price?: number | null; yearly_price?: number | null }) {
  const full = r2(Number(p.monthly_price ?? 0) * 12);
  const d = (v: number) => (full > 0 ? r2(Math.max(0, (1 - v / full) * 100)) : 0);
  return { fullYear: full, quarterlyDiscount: d(Number(p.quarterly_price ?? 0) * 4), yearlyDiscount: d(Number(p.yearly_price ?? 0)) };
}
