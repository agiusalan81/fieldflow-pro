export const BILLING_CADENCES = ["monthly", "quarterly", "yearly"] as const;
export const DEFAULT_TRIAL_DAYS = 60;
export function monthlyEquivalent(price: number, cadence: string) { return price / (cadence === "yearly" ? 12 : cadence === "quarterly" ? 3 : 1); }
export function trialAccess(end: string, now: number) { return new Date(end).getTime() > now; }
export function costPerUser(expenses: number, users: number) { return users > 0 ? expenses / users : null; }
export function estimatePhotoStorage(sheets: number, photosPerSheet = 4, megabytesPerPhoto = 1.2) { return sheets * photosPerSheet * megabytesPerPhoto; }
export function effectiveModules(base: string[], packs: string[][], overrides: { module: string; enabled: boolean; starts_at: string; ends_at: string }[], now: number) {
  const modules = new Set(["core", ...base, ...packs.flat()]);
  for (const o of overrides) if (new Date(o.starts_at).getTime() <= now && new Date(o.ends_at).getTime() > now) { if (o.enabled) modules.add(o.module); else modules.delete(o.module); }
  return [...modules];
}