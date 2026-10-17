import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export const CONTACT_ROLE = "contact_role";

export function useContactRoles() {
  return useQuery({
    queryKey: ["contact-roles"],
    queryFn: async () => (await supabase.from("lookup_options").select("*").eq("category", CONTACT_ROLE).order("usage_count", { ascending: false })).data ?? [],
  });
}

/** Records a role title: bumps usage on a known one, or adds it as an unverified suggestion for admin review. */
export async function learnContactRole(title: string, companyId: string, userId: string) {
  const t = title.trim();
  if (!t) return;
  const { data: rows } = await supabase.from("lookup_options").select("id, label_value, usage_count").eq("category", CONTACT_ROLE);
  const hit = (rows ?? []).find((r) => r.label_value.toLowerCase() === t.toLowerCase());
  if (hit) await supabase.from("lookup_options").update({ usage_count: hit.usage_count + 1 }).eq("id", hit.id);
  else await supabase.from("lookup_options").insert({ category: CONTACT_ROLE, label_value: t, company_id: companyId, created_by_user_id: userId, is_global: false, is_approved: false, usage_count: 1 });
}

export function RoleCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const { data = [] } = useContactRoles();
  return (
    <>
      <Input list={id} placeholder="Role / title (e.g. Building manager)" value={value} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>{data.filter((r) => r.is_approved).map((r) => <option key={r.id} value={r.label_value} />)}</datalist>
    </>
  );
}
