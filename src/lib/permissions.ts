import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Role } from "@/lib/profile";

/** Screens / dashboard widgets a company superuser can switch on or off per role. UI visibility only — data access is still enforced by role in the database. */
export const MODULES = [
  { key: "live_status", label: "Live technician status" },
  { key: "dispatch", label: "Schedule & dispatch" },
  { key: "approvals", label: "Asset & overtime approvals" },
  { key: "pending_works", label: "Pending works" },
  { key: "estimates", label: "New lift estimates & supplier estimates" },
  { key: "contracts", label: "Contracts, checklists & renewals" },
  { key: "billing", label: "Billing & overtime hours" },
  { key: "clients", label: "Clients & assets" },
  { key: "inventory", label: "Inventory" },
  { key: "leave_approvals", label: "Leave approvals" },
  { key: "team", label: "Team & invite links" },
  { key: "fields", label: "Custom fields & lookups" },
] as const;
export type ModuleKey = (typeof MODULES)[number]["key"];

export const ROLES: Role[] = ["superuser", "admin", "supervisor", "technician", "maintenance"];

const ALL = MODULES.map((m) => m.key);
export const DEFAULT_MODULES: Record<Role, ModuleKey[]> = {
  superuser: ALL,
  admin: ["live_status", "dispatch", "approvals", "pending_works", "contracts", "billing", "clients", "inventory", "leave_approvals", "team", "fields"],
  supervisor: ["live_status", "dispatch", "approvals", "pending_works", "estimates", "clients", "inventory", "leave_approvals", "team"],
  technician: [],
  maintenance: [],
};

export type PermRow = { role: string; module: string; enabled: boolean };

/** Resolves whether a role sees a module: company override first, then default. Superuser always sees everything so they can't lock themselves out. */
export function canSee(role: Role, module: ModuleKey, rows: PermRow[]) {
  if (role === "superuser") return true;
  const o = rows.find((r) => r.role === role && r.module === module);
  return o ? o.enabled : DEFAULT_MODULES[role].includes(module);
}

export function usePermRows(enabled = true) {
  return useQuery({
    queryKey: ["role-permissions"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role, module, enabled");
      if (error) throw error;
      return data as PermRow[];
    },
    staleTime: 60_000,
  });
}

export function useCan(profile?: Profile | null) {
  const { data = [] } = usePermRows(!!profile);
  return (m: ModuleKey) => !!profile && canSee(profile.role, m, data);
}
