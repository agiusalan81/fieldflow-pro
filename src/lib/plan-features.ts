import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Features Platform HQ can include in plans/packs or switch on/off per company. */
export const PLAN_FEATURES = [
  { key: "core", label: "Core: job sheets, schedule, clients, team" },
  { key: "tracking", label: "Shift location & live map" },
  { key: "fleet_management", label: "Fleet Management: routes, mileage & fuel" },
  { key: "receipts", label: "Receipt scan to PDF" },
  { key: "technical_library", label: "Technical library" },
  { key: "standby", label: "Standby roster & swaps" },
  { key: "estimates", label: "Estimates & lift RFQ" },
  { key: "supplier_email", label: "Supplier emails & reminders" },
  { key: "contracts", label: "Contracts & renewals" },
  { key: "payroll", label: "Payroll" },
  { key: "safety", label: "Safety & faults" },
  { key: "reports", label: "Client reports" },
  { key: "digitization", label: "Document digitization" },
  { key: "custom_app_title", label: "Custom app title (replaces FieldBridge)" },
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number]["key"];

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
    queryFn: async () => { const { data, error } = await supabase.rpc("my_commercial_status"); if (error) throw error; return data as Status; },
  });
  return (key: string) => featureOn(q.data, key);
}
