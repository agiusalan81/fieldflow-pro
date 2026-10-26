import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/profile";

/** Roles that are field staff by their primary role. */
export const FIELD_ROLES: Role[] = ["technician", "supervisor", "maintenance"];
/** Office roles that may additionally be granted field dispatch. */
export const OFFICE_ROLES: Role[] = ["superuser", "admin"];

/** Mirrors DB is_dispatchable_member: field role, or office role with the field-dispatch capability. */
export function isDispatchable(role: string, active: boolean, canFieldDispatch: boolean): boolean {
  if (!active) return false;
  return (FIELD_ROLES as string[]).includes(role) || canFieldDispatch;
}

/** Only office roles get the field-dispatch toggle (field roles already have it). */
export function showsFieldDispatchToggle(memberRole: string): boolean {
  return (OFFICE_ROLES as string[]).includes(memberRole);
}

/** Mirrors DB set_member_capabilities: superuser edits anyone; admin edits non-superusers. */
export function canEditCapabilities(actorRole: string, memberRole: string): boolean {
  if (actorRole === "superuser") return true;
  return actorRole === "admin" && memberRole !== "superuser";
}

export function useFieldDispatchIds() {
  return useQuery({
    queryKey: ["member-capabilities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, can_field_dispatch").eq("can_field_dispatch", true);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id));
    },
    staleTime: 60_000,
  });
}
