export const HQ_GROUPS = [
  { key: "overview", label: "Overview", sections: [{ key: "overview", label: "Portfolio overview" }] },
  { key: "analytics", label: "Analytics & Radar", sections: [{ key: "analytics", label: "Analytics & Radar" }] },
  { key: "tenants", label: "Tenants & companies", sections: [{ key: "tenants", label: "Companies" }, { key: "billing", label: "Invoices & reminders" }, { key: "finance", label: "Revenue & expenses" }, { key: "referrals", label: "Referrals" }] },
  { key: "plans", label: "Plans, tiers & modules", sections: [{ key: "plans", label: "Tiers & packs" }, { key: "settings", label: "Product settings" }, { key: "campaigns", label: "Promotions" }] },
  { key: "legal", label: "Platform company & legal", sections: [{ key: "legal", label: "Company details" }, { key: "audit", label: "Audit history" }] },
] as const;
export function hqGroup(section: string) { return HQ_GROUPS.find(g => g.sections.some(s => s.key === section)) ?? HQ_GROUPS[0]; }
export function tenantLocation(city: string, country: string) { return [city.trim(), country.trim()].filter(Boolean).join(", ") || "Not provided"; }
export const SAFE_RESET_MODULES = [
  { key: "qs_pricing", label: "Pricing & QS", detail: "Unsent draft proposals without linked surveys" },
  { key: "skills_dispatch", label: "Skills & Smart Dispatch", detail: "Unused skills only; assignments and dispatch remain" },
] as const;
export function canResetTestCompany(isTest: boolean, name: string, confirmation: string, modules: string[]) {
  return isTest && name === confirmation && modules.length > 0 && modules.every(m => SAFE_RESET_MODULES.some(s => s.key === m));
}