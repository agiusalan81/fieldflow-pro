import { parseEdition } from "@/lib/editions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Features Platform HQ can include in plans/packs or switch on/off per company. */
export const PLAN_FEATURES = [
  { key: "core", label: "Operations: job sheets, schedule, clients & team" },
  { key: "customer_quotes", label: "Customer quoting & simple proposals" },
  { key: "client_management", label: "Client management: sites & multiple contacts" },
  { key: "tracking", label: "Shift location & live map" },
  { key: "fleet_management", label: "Fleet Management: routes, mileage & fuel" },
  { key: "skills_dispatch", label: "Skills & Smart Dispatch: custom skills, crews, open jobs" },
  { key: "receipts", label: "Receipt scan to PDF" },
  { key: "technical_library", label: "Technical library" },
  { key: "standby", label: "On-call rota & swaps" },
  { key: "estimates", label: "Lift supplier RFQ & estimate tracking" },
  { key: "site_surveys", label: "Site surveys: field inspections & reviewer pricing" },
  { key: "qs_pricing", label: "Pricing & quantity surveying: price lists, BoQ, as-built QS" },
  { key: "supplier_email", label: "Lift supplier emails & reminders" },
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
  { key: "client_portal", label: "Client Experience: on-my-way ETA, QR compliance logbook, online approvals" },
  { key: "ppm_automation", label: "Commercial PPM: recurring visits, SLA timers, component history" },
  { key: "lift_pack", label: "Lifts & Escalators pack: component pricing, lift surveys & RFQ" },
  { key: "job_profitability", label: "Financial Intelligence: job margins & contract profitability" },
  { key: "crm_pipeline", label: "CRM pipeline: leads, follow-ups & conversion" },
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number]["key"];

/** Plain-language overview of what each module unlocks, shown in HQ. */
export const MODULE_DESCRIPTIONS: Record<string, string> = {
  core: "Job sheets, schedule, dispatch, clients, sites, equipment, team, customer estimates and simple proposals. Always included.",
  customer_quotes: "Core customer estimates and simple proposals: labour/material line items, discounts, VAT, branded PDFs and secure sharing. Separate from internal lift supplier RFQs; included with Core.",
  client_management: "Staff-managed sites, multiple contacts and document delivery preferences. Included from Plus upwards; the customer portal is a separate optional pack.",
  tracking: "Technicians share location only while clocked in; managers see them on a live map.",
  fleet_management: "Vehicle list, daily routes and replay, mileage and fuel cost estimates.",
  skills_dispatch: "Custom skill catalogue, skill matching, crews larger than two, and open jobs technicians can claim.",
  receipts: "Photo-only expense stash, cropped private receipt PDFs, job sheet attachments, office-approved categories and monthly per-person PDF archives.",
  technical_library: "Private manuals and drawings by trade, maker and model, with AI search over approved pages.",
  standby: "Independent technician and supervisor on-call rotas on one calendar, contact access and role-matched swaps with manager approval.",
  site_surveys: "Universal site surveys captured in the field, routed to an office reviewer and priced with the price generator. Sold separately from Estimates and can be bundled in packs.",
  estimates: "Vertical lift supplier RFQs, technical specifications and internal estimate follow-up within the Lifts & Escalators suite. Supplier prices never enter customer documents automatically.",
  qs_pricing: "Company price lists, bills of quantities and as-built quantity surveying.",
  supplier_email: "Email suppliers from estimates and send automatic follow-up reminders.",
  contracts: "Core multi-asset/site contracts, agreed checklists, equipment prices and staggered renewals. Lift pricing and automatic PPM remain optional packs.",
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
  client_portal: "Optional service pack: client password portal, self-service contacts and site-based email/WhatsApp preferences, branded QR compliance logbook and online proposal approval. Existing on-my-way messages remain in base plans.",
  ppm_automation: "Optional service pack: contract-driven recurring maintenance visits, SLA breach countdowns and part replacement/warranty history per asset.",
  lift_pack: "Vertical trade pack for lift and escalator companies: stops, landing doors and car-access pricing with sample calculations on client documents. Only shown to companies whose trade is lifts or escalators.",
  job_profitability: "Optional service pack: real-time job gross margin from labour, overtime, parts and receipts, plus loss-making contract alerts.",
  crm_pipeline: "Lead pipeline for phone, email and portal enquiries: voice-dictated call notes, customisable follow-up reminders on the bell, and one-click conversion of won leads into estimates or jobs. Included from Plus upwards.",
};

export const DEFAULT_APP_TITLE = "FieldBridge";
/** Tenant's own app title only when their plan includes it; otherwise FieldBridge. */
export function resolveAppTitle(custom: string | undefined | null, allowed: boolean) {
  const t = (custom ?? "").trim();
  return allowed && t ? t : DEFAULT_APP_TITLE;
}

type Status = { state?: string; modules?: { name: string; enabled: boolean }[] | null; hide_locked_modules?: boolean | null; hidden_modules?: string[] | null; coming_soon_modules?: string[] | null };

/** Feature is on unless the company's plan lists it and it is switched off. Companies without a plan keep everything. */
export function featureOn(status: Status | undefined, key: string) {
  if (key === "customer_quotes" || key === "contracts") return featureOn(status, "core");
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

/** HQ display choices for locked modules: hide entirely (e.g. grandfathered tenants) or mark as Coming soon. */
export function lockedVisibility(status: Status | undefined, key: string) {
  if (key === "customer_quotes" || key === "contracts") return lockedVisibility(status, "core");
  const comingSoon = !!status?.coming_soon_modules?.includes(key);
  const hidden = !comingSoon && (!!status?.hide_locked_modules || !!status?.hidden_modules?.includes(key));
  return { hidden, comingSoon };
}
export function useLockedVisibility() {
  const q = useQuery({ queryKey: ["plan-features"], staleTime: 60_000, queryFn: async () => { const { data, error } = await supabase.rpc("my_commercial_status"); if (error) throw error; return data as Status; } });
  return (key: string) => lockedVisibility(q.data, key);
}

/** A menu/route entry is locked when the plan switches it off OR HQ marked it Coming soon — Coming soon greys the item even when the package includes it. */
export function navEntryLocked(status: Status | undefined, key: string) {
  const vis = lockedVisibility(status, key);
  return { locked: vis.comingSoon || !featureOn(status, key), soon: vis.comingSoon, hidden: vis.hidden && !vis.comingSoon };
}
export function useNavLock(enabled = true) {
  const q = useQuery({ queryKey: ["plan-features"], enabled, staleTime: 60_000, queryFn: async () => { const { data, error } = await supabase.rpc("my_commercial_status"); if (error) throw error; return data as Status; } });
  return (key: string) => navEntryLocked(q.data, key);
}

/** Product edition from the company's HQ product (hotel / retail / contractor). */
export function useEdition(enabled = true) {
  const q = useQuery({ queryKey: ["plan-features"], enabled, staleTime: 60_000, queryFn: async () => { const { data, error } = await supabase.rpc("my_commercial_status"); if (error) throw error; return data as Status; } });
  const d = q.data as (Status & { edition?: string; product_name?: string }) | undefined;
  return { edition: parseEdition(d?.edition), productName: d?.product_name };
}
