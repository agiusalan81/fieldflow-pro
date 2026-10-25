import { PLAN_FEATURES } from "./plan-features";

/** HQ presentation grouping for modules; unknown keys fall into "Other modules". */
export const MODULE_CATEGORIES = [
  { key: "field", label: "Field & Operations", modules: ["core", "digitization", "safety", "technical_library"] },
  { key: "team", label: "Team & Roster", modules: ["skills_dispatch", "standby"] },
  { key: "fleet", label: "Fleet & Location", modules: ["fleet_management", "tracking"] },
  { key: "clients", label: "Clients & Commercial", modules: ["customer_quotes", "client_management", "client_portal", "contracts", "estimates", "qs_pricing", "reports", "site_surveys", "supplier_email"] },
  { key: "finance", label: "Finance & Payroll", modules: ["job_profitability", "payroll", "payroll_statutory_mt", "receipts"] },
  { key: "assets", label: "Asset Intelligence", modules: ["ppm_automation"] },
  { key: "brand", label: "Brand Studio & White-Label", modules: ["branding_advanced", "branding_basic", "branding_custom_fonts", "branding_documents", "branding_fonts", "branding_industry", "client_presentation", "custom_app_title"] },
  { key: "trade", label: "Trade Specialization", modules: ["lift_pack"] },
] as const;

export const MODULE_LAYERS = [
  { key: "core", label: "Core" },
  { key: "horizontal", label: "Horizontal" },
  { key: "vertical", label: "Vertical" },
] as const;
export type ModuleLayer = typeof MODULE_LAYERS[number]["key"];
export function moduleLayer(key: string): ModuleLayer {
  if (["core", "customer_quotes", "branding_basic"].includes(key)) return "core";
  if (["lift_pack", "estimates", "supplier_email"].includes(key)) return "vertical";
  return "horizontal";
}
export function filterModules(keys: readonly string[], layer: ModuleLayer | "all", category = "all") {
  return sortModules(keys.filter(key => (layer === "all" || moduleLayer(key) === layer) && (category === "all" || moduleCategory(key) === category)));
}

export const moduleLabel = (key: string) => PLAN_FEATURES.find((f) => f.key === key)?.label ?? key.replace(/_/g, " ");
export function moduleCategory(key: string) {
  return MODULE_CATEGORIES.find((c) => (c.modules as readonly string[]).includes(key))?.label ?? "Other modules";
}

/** Groups modules in category order, alphabetical by label inside each group; empty groups are omitted. */
export function groupModules(keys: readonly string[]) {
  const unique = [...new Set(keys)];
  const order = [...MODULE_CATEGORIES.map((c) => c.label as string), "Other modules"];
  return order
    .map((label) => ({ label, modules: unique.filter((k) => moduleCategory(k) === label).sort((a, b) => moduleLabel(a).localeCompare(moduleLabel(b))) }))
    .filter((g) => g.modules.length > 0);
}

/** Flat list in the same grouped, alphabetical order. */
export const sortModules = (keys: readonly string[]) => groupModules(keys).flatMap((g) => g.modules);
