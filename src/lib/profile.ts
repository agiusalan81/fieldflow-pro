import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/** UI-only "View As" mode. Data access is still enforced by the real role on the server. */
export type Role = "superuser" | "admin" | "supervisor" | "technician";
export type ViewAs = Role;
export const canViewAsRoles = (realRole?: Role) => realRole === "superuser";
export const resolveDisplayedRole = (realRole: Role, viewAs: ViewAs | null): Role => canViewAsRoles(realRole) && viewAs ? viewAs : realRole;
export const ROLE_LABEL: Record<Role, string> = { superuser: "Company Superuser", admin: "Office Admin", supervisor: "Supervisor", technician: "Technician" };
const VIEW_KEY = "fieldops:view-as";
const listeners = new Set<() => void>();
export function setViewAs(v: ViewAs | null) {
  if (v) localStorage.setItem(VIEW_KEY, v); else localStorage.removeItem(VIEW_KEY);
  listeners.forEach((l) => l());
}
function useViewAsRaw() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => localStorage.getItem(VIEW_KEY) as ViewAs | null,
    () => null,
  );
}
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  role: Role;
  companies: { name: string } | null;
  phone_number: string | null;
  home_address: string | null;
  next_of_kin_1: Kin;
  next_of_kin_2: Kin;
  app_theme_preference: "light" | "dark";
  language_preference: string;
  employee_id: string | null;
  technician_initials: string | null;
  signature_on_file: string | null;
  /** The account's real role; `role` reflects the active View As mode. */
  real_role: Role;
};
export type Kin = { name?: string; relationship?: string; phone?: string; email?: string };

export function useProfile() {
  const viewAs = useViewAsRaw();
  const q = useRealProfile();
  const data = q.data ? { ...q.data, role: resolveDisplayedRole(q.data.real_role, viewAs) } : q.data;
  return { ...q, data } as typeof q;
}

function useRealProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("users")
        .select("id, company_id, full_name, email, role, companies(name), phone_number, home_address, next_of_kin_1, next_of_kin_2, app_theme_preference, language_preference, employee_id, technician_initials, signature_on_file")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id).maybeSingle();
      const real = (r?.role ?? "technician") as Role;
      return { ...data, role: real, real_role: real } as unknown as Profile;
    },
    staleTime: 60_000,
  });
}

export const isManager = (p?: Profile | null) => !!p && p.role !== "technician";
/** Superuser or Office Admin (the commercial side). */
export const isOffice = (p?: Profile | null) => p?.role === "admin" || p?.role === "superuser";

export function useCompanyUsers() {
  return useQuery({
    queryKey: ["company-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("id, full_name, role, technician_initials").order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

export function hoursBetween(a?: string | null, b?: string | null) {
  if (!a) return 0;
  const end = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, (end - new Date(a).getTime()) / 3_600_000);
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  in_transit: "In transit",
  in_progress: "In progress",
  completed: "Completed",
};

export const initialsOf = (u: { full_name: string; technician_initials?: string | null }) =>
  u.technician_initials || u.full_name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
