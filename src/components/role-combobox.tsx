import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export const CONTACT_ROLE = "contact_role";
export const EQUIPMENT_TYPE = "equipment_type";
export const CONTRACT_CATEGORY = "contract_category";

/** Where each learnt lookup is used, so renames/merges can update existing records. */
export const LOOKUP_TARGETS: Record<string, { table: "client_contacts" | "assets" | "contract_types"; column: string; title: string; hint: string }> = {
  [CONTACT_ROLE]: { table: "client_contacts", column: "role_title", title: "Contact roles", hint: "New titles typed on contacts appear here for review." },
  [EQUIPMENT_TYPE]: { table: "assets", column: "asset_category", title: "Equipment types", hint: "Types entered under \"Other\" on equipment appear here for review." },
  [CONTRACT_CATEGORY]: { table: "contract_types", column: "contract_category", title: "Contract categories", hint: "Categories entered under \"Other\" on contract types appear here." },
};

export function useLookup(category: string) {
  return useQuery({
    queryKey: ["lookup", category],
    queryFn: async () => (await supabase.from("lookup_options").select("*").eq("category", category).order("usage_count", { ascending: false })).data ?? [],
  });
}
export const useContactRoles = () => useLookup(CONTACT_ROLE);

/** Records a value: bumps usage on a known one, or adds it as an unverified suggestion for admin review. */
export async function learnLookup(category: string, title: string, companyId: string, userId: string) {
  const t = title.trim();
  if (!t) return;
  const { data: rows } = await supabase.from("lookup_options").select("id, label_value, usage_count").eq("category", category);
  const hit = (rows ?? []).find((r) => r.label_value.toLowerCase() === t.toLowerCase());
  if (hit) await supabase.from("lookup_options").update({ usage_count: hit.usage_count + 1 }).eq("id", hit.id);
  else await supabase.from("lookup_options").insert({ category, label_value: t, company_id: companyId, created_by_user_id: userId, is_global: false, is_approved: false, usage_count: 1 });
}
export const learnContactRole = (title: string, companyId: string, userId: string) => learnLookup(CONTACT_ROLE, title, companyId, userId);

export function LookupInput({ category, value, onChange, placeholder }: { category: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  const { data = [] } = useLookup(category);
  return (
    <>
      <Input list={id} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>{data.filter((r) => r.is_approved).map((r) => <option key={r.id} value={r.label_value} />)}</datalist>
    </>
  );
}

export function RoleCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <LookupInput category={CONTACT_ROLE} value={value} onChange={onChange} placeholder="Role / title (e.g. Building manager)" />;
}
