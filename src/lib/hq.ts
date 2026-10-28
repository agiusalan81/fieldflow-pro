export const HQ_GROUPS = [
  { key: "overview", label: "Overview", sections: [{ key: "overview", label: "Portfolio overview" }] },
  { key: "analytics", label: "Analytics & Radar", sections: [{ key: "analytics", label: "Analytics & Radar" }] },
  { key: "tenants", label: "Tenants & companies", sections: [{ key: "tenants", label: "Companies" }, { key: "billing", label: "Invoices & reminders" }, { key: "bespoke", label: "Bespoke requests" }, { key: "finance", label: "Revenue & expenses" }, { key: "referrals", label: "Referrals" }] },
  { key: "plans", label: "Plans, tiers & modules", sections: [{ key: "plans", label: "Tiers & packs" }, { key: "construction", label: "Under construction" }, { key: "settings", label: "Product settings" }, { key: "campaigns", label: "Promotions" }] },
  { key: "legal", label: "Platform company & legal", sections: [{ key: "legal", label: "Company details" }, { key: "audit", label: "Audit history" }] },
] as const;
export function hqGroup(section: string) { return HQ_GROUPS.find(g => g.sections.some(s => s.key === section)) ?? HQ_GROUPS[0]; }
export function tenantLocation(city: string, country: string) { return [city.trim(), country.trim()].filter(Boolean).join(", ") || "Not provided"; }
export const trialUsesFullFeatures = (status: string, packageOnly: boolean) => status === 'trial' && !packageOnly;
/** Presentation grouping only; mixed feature/storage bundles remain module packs. */
export function isStorageAddon(item: { kind?: string; storage_gb?: number; modules?: string[] }) {
  return item.kind === "pack" && (item.storage_gb ?? 0) > 0 && (item.modules?.length ?? 0) === 0;
}
export const SAFE_RESET_MODULES = [
  { key: "qs_pricing", label: "Pricing & QS drafts", detail: "Unsent draft proposals without linked surveys" },
  { key: "skills_dispatch", label: "Unused skills", detail: "Skills not assigned to anyone or any job" },
  { key: "crm", label: "CRM leads", detail: "All leads, activities and follow-ups" },
  { key: "quotes", label: "Estimates, quotes & proposals", detail: "All customer quotes, proposals, lift estimates and costing sheets" },
  { key: "surveys", label: "Site visits & surveys", detail: "All site visits, lift surveys and QS surveys" },
  { key: "job_sheets", label: "Job sheets & dispatch", detail: "All jobs, job sheets, parts, time logs and client reports" },
  { key: "time_tracking", label: "Shifts & time tracking", detail: "Clock-ins, daily work reports, overtime and GPS points" },
  { key: "chat", label: "Team chat", detail: "All chat messages" },
  { key: "expenses", label: "Expenses", detail: "All expense receipts" },
  { key: "leave", label: "Leave requests", detail: "All leave requests" },
  { key: "passport_photos", label: "Passport photos & handovers", detail: "Field submissions; saved passports remain" },
  { key: "equipment_reports", label: "Equipment problem reports", detail: "Reported faults from QR links" },
] as const;
export function canResetTestCompany(isTest: boolean, name: string, confirmation: string, modules: string[]) {
  return isTest && name === confirmation && modules.length > 0 && modules.every(m => SAFE_RESET_MODULES.some(s => s.key === m));
}
export function canCleanSlate(isTest: boolean, name: string, confirmation: string) {
  return isTest && name.length > 0 && name === confirmation;
}