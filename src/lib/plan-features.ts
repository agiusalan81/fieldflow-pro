import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Features Platform HQ can include in plans/packs or switch on/off per company. */
export const PLAN_FEATURES = [
  { key: "core", label: "Core: job sheets, schedule, clients, team" },
  { key: "tracking", label: "Shift location & live map" },
  { key: "fleet_management", label: "Fleet Management: routes, mileage & fuel" },
  { key: "skills_dispatch", label: "Skills & Smart Dispatch: custom skills, crews, open jobs" },
  { key: "receipts", label: "Receipt scan to PDF" },
  { key: "technical_library", label: "Technical library" },
  { key: "standby", label: "On-call rota & swaps" },
  { key: "estimates", label: "Estimates & lift RFQ" },
  { key: "qs_pricing", label: "Pricing & quantity surveying: price lists, BoQ, as-built QS" },
  { key: "supplier_email", label: "Supplier emails & reminders" },
  { key: "contracts", label: "Contracts & renewals" },
  { key: "payroll", label: "Payroll: hours & international gross earnings" },
  { key: "safety", label: "Safety & faults" },
  { key: "reports", label: "Client reports" },
  { key: "digitization", label: "Document digitization" },
  { key: "custom_app_title", label: "Custom app title (replaces FieldBridge)" },
  { key: "branding_basic", label: "Basic company branding" },
  { key: "branding_advanced", label: "Brand Studio: themes & backgrounds" },
  { key: "branding_fonts", label: "Extended document font library" },
  { key: "branding_custom_fonts", label: "Custom font uploads" },
  { key: "branding_documents", label: "Document Studio: frames & styling" },
  { key: "branding_industry", label: "Industry Experience: icons & wording" },
  { key: "client_presentation", label: "Branded client presentation" },
  { key: "payroll_statutory_mt", label: "Malta statutory payroll" },
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number]["key"];

/** Plain-language overview of what each module unlocks, shown in HQ. */
export const MODULE_DESCRIPTIONS: Record<string, string> = {
  core: "Job sheets, schedule, dispatch, clients, sites, equipment and team. Always included.",
  tracking: "Technicians share location only while clocked in; managers see them on a live map.",
  fleet_management: "Vehicle list, daily routes and replay, mileage and fuel cost estimates.",
  skills_dispatch: "Custom skill catalogue, skill matching, crews larger than two, and open jobs technicians can claim.",
  receipts: "Photo-only expense stash, cropped private receipt PDFs, job sheet attachments, office-approved categories and monthly per-person PDF archives.",
  technical_library: "Private manuals and drawings by trade, maker and model, with AI search over approved pages.",
  standby: "Independent technician and supervisor on-call rotas on one calendar, contact access and role-matched swaps with manager approval.",
  estimates: "Trade-specific estimates and lift requests for quotation sent to suppliers.",
  qs_pricing: "Company price lists, bills of quantities and as-built quantity surveying.",
  supplier_email: "Email suppliers from estimates and send automatic follow-up reminders.",
  contracts: "Maintenance agreements, contract tiers and renewal reminders.",
  payroll: "Hours, overtime and gross earnings with issued payslips that cannot be changed.",
  safety: "Safety checklists and a fault library used on job sheets.",
  reports: "Share client reports through secure, expiring links.",
  digitization: "Scan paper documents and turn photos into searchable PDFs.",
  custom_app_title: "Show the company's own app name instead of FieldBridge.",
  branding_basic: "Company logo and colours on the app and documents.",
  branding_advanced: "Brand Studio themes and backgrounds.",
  branding_fonts: "A larger choice of fonts for documents.",
  branding_custom_fonts: "Upload the company's own font files.",
  branding_documents: "Document Studio frames, text styles and field fills.",
  branding_industry: "Icons and wording tailored to the company's trade.",
  client_presentation: "Branded presentation for clients across reports and emails.",
  payroll_statutory_mt: "Malta tax, social security and statutory bonus calculations.",
};

export const DEFAULT_APP_TITLE = "FieldBridge";
/** Tenant's own app title only when their plan includes it; otherwise FieldBridge. */
export function resolveAppTitle(custom: string | undefined | null, allowed: boolean) {
  const t = (custom ?? "").trim();
  return allowed && t ? t : DEFAULT_APP_TITLE;
}

type Status = { state?: string; modules?: { name: string; enabled: boolean }[] | null };

/** Feature is on unless the company's plan lists it and it is switched off. Companies without a plan keep everything. */
export function featureOn(status: Status | undefined, key: string) {
  if (!status || status.state === "legacy") return true;
  const m = status.modules?.find((x) => x.name === key);
  return m ? m.enabled : true;
}

export function usePlanFeatures(enabled = true) {
  const q = useQuery({
    queryKey: ["plan-features"],
    enabled,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
    queryFn: async () => { const { data, error } = await supabase.rpc("my_commercial_status"); if (error) throw error; return data as Status; },
  });
  return (key: string) => featureOn(q.data, key);
}
