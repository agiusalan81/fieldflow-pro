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
}