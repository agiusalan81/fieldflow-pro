import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, type Profile, type Role } from "@/lib/profile";

/** Temporary tenant control. Remove the control, not the read-target helpers, when moving to the SaaS portal. */
export const TENANT_USER_PREVIEW_ENABLED = true;
export const USER_PREVIEW_PATHS = ["/dashboard", "/sheets", "/hours", "/dwr", "/leave", "/schedule"];
export type PreviewMember = Pick<Profile, "id" | "company_id" | "full_name" | "email" | "employee_id" | "technician_initials"> & { role: Role };
type Selection = { actorId: string; userId: string };
let selection: Selection | null = null;
const listeners = new Set<() => void>();

export function canPreviewUsers(actor?: Pick<Profile, "real_role"> | null) {
  return TENANT_USER_PREVIEW_ENABLED && actor?.real_role === "superuser";
}

export function resolvePreviewMember(actor: Profile | null | undefined, selected: Selection | null, members: PreviewMember[]) {
  if (!actor || !canPreviewUsers(actor) || selected?.actorId !== actor.id || selected.userId === actor.id) return null;
  return members.find((u) => u.id === selected.userId && u.company_id === actor.company_id) ?? null;
}

export function clearUserPreview() {
  selection = null;
  listeners.forEach((notify) => notify());
}

/** No session impersonation and no privilege changes; the selection intentionally expires on page reload. */
export function selectPreviewUser(actor: Profile, userId: string | null, members: PreviewMember[]) {
  if (!canPreviewUsers(actor)) return;
  selection = userId && resolvePreviewMember(actor, { actorId: actor.id, userId }, members)
    ? { actorId: actor.id, userId } : null;
  listeners.forEach((notify) => notify());
}

export function useUserPreview(actor: Profile | null | undefined) {
  const selected = useSyncExternalStore(
    (notify) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
    () => selection,
    () => null,
  );
  const eligible = canPreviewUsers(actor);
  const query = useQuery({
    queryKey: ["user-preview-members", actor?.id],
    enabled: eligible,
    queryFn: async (): Promise<PreviewMember[]> => {
      // Both reads run with the real session and existing tenant RLS; never use users.role.
      const [users, roles] = await Promise.all([
        supabase.from("users").select("id, company_id, full_name, email, employee_id, technician_initials").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (users.error) throw users.error;
      if (roles.error) throw roles.error;
      const rank: Role[] = ["superuser", "admin", "supervisor", "technician", "maintenance"];
      return (users.data ?? []).flatMap((user) => {
        const role = rank.find((r) => roles.data?.some((row) => row.user_id === user.id && row.role === r));
        return role ? [{ ...user, role }] : [];
      });
    },
    staleTime: 30_000,
  });
  const member = resolvePreviewMember(actor, selected, query.data ?? []);
  useEffect(() => {
    if (selected && (!eligible || selected.actorId !== actor?.id || (query.isSuccess && !member))) clearUserPreview();
  }, [selected, eligible, actor?.id, query.isSuccess, member]);
  return { member, active: !!member, eligible, members: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

/** Only opt-in read screens use this profile; all other useProfile callers keep the signed-in identity. */
export function usePreviewProfile() {
  const query = useProfile();
  const preview = useUserPreview(query.data);
  const data = query.data && preview.member ? {
    ...query.data,
    ...preview.member,
  } : query.data;
  return { ...query, data, isPreview: preview.active };
}