import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, type Role } from "@/lib/profile";
import { CRM_LEVELS, crmDefaultLevel, crmEffective } from "@/lib/crm";
import { usePlanFeatures } from "@/lib/plan-features";
import { ActionTypesEditor } from "@/components/crm-pipeline";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";

type Member = { user_id: string; role: Role; crm_access: string | null; name: string; email: string };

/** Company Settings → CRM settings: module status, follow-up types and per-member CRM access. */
export function CrmSettings({ companyId, actorRole }: { companyId: string; actorRole: Role }) {
  const qc = useQueryClient();
  const on = usePlanFeatures();
  const members = useQuery({
    queryKey: ["crm-members", companyId],
    queryFn: async () => {
      const [roles, users] = await Promise.all([
        supabase.from("user_roles").select("user_id, role, crm_access, registration_status").eq("registration_status", "active"),
        supabase.from("users").select("id, full_name, email"),
      ]);
      if (roles.error) throw roles.error; if (users.error) throw users.error;
      const byId = new Map((users.data ?? []).map((u) => [u.id, u]));
      return (roles.data ?? []).map((r) => ({ user_id: r.user_id, role: r.role as Role, crm_access: r.crm_access, name: byId.get(r.user_id)?.full_name ?? "Unnamed", email: byId.get(r.user_id)?.email ?? "" }))
        .sort((a, b) => a.name.localeCompare(b.name)) as Member[];
    },
  });
  const canEdit = actorRole === "superuser" || actorRole === "admin";
  const setLevel = async (m: Member, value: string) => {
    const level = value === "default" ? null : value;
    const r = await supabase.rpc("set_member_crm_access", { _user: m.user_id, ...(level ? { _level: level } : {}) } as never);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(`CRM access updated for ${m.name}`);
    await Promise.all([qc.invalidateQueries({ queryKey: ["crm-members"] }), qc.invalidateQueries({ queryKey: ["crm-access"] })]);
  };
  const active = on("crm_pipeline");
  return <div className="space-y-6">
    <section className="space-y-2 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">CRM module</h3><Badge variant={active ? "default" : "outline"}>{active ? "Active on your plan" : "Not on your plan"}</Badge></div>
      <p className="text-sm text-muted-foreground">{active ? "Leads, follow-ups and conversions are available to members with CRM access below." : "Upgrade to Plus or add the CRM pack to use the pipeline. You can still prepare access now."}</p>
    </section>

    <section className="rounded-xl border bg-card">
      <div className="border-b px-5 py-3">
        <h3 className="font-medium">Who can do what</h3>
        <p className="text-sm text-muted-foreground">Pick a CRM level for each person. “Role default” follows their main role. Superusers always have full access.</p>
      </div>
      <ul className="grid gap-2 px-5 py-3 text-xs text-muted-foreground sm:grid-cols-2">{CRM_LEVELS.map((l) => <li key={l.key}><span className="font-medium text-foreground">{l.label}:</span> {l.detail}</li>)}</ul>
      <div className="divide-y border-t">
        {members.isLoading && <p className="p-5 text-sm text-muted-foreground">Loading team…</p>}
        {(members.data ?? []).map((m) => {
          const eff = crmEffective(m.role, m.crm_access);
          const locked = !canEdit || m.role === "superuser";
          return <div key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{m.name}</p><p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[m.role]}{m.email ? ` · ${m.email}` : ""}</p></div>
            <NativeSelect aria-label={`CRM access for ${m.name}`} className="w-full sm:w-56" disabled={locked} value={m.role === "superuser" ? "manager" : m.crm_access ?? "default"} onValueChange={(v) => void setLevel(m, v)}>
              {m.role !== "superuser" && <option value="default">Role default ({CRM_LEVELS.find((l) => l.key === crmDefaultLevel(m.role))?.label})</option>}
              {CRM_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
            </NativeSelect>
            <Badge variant="outline" className="shrink-0">{CRM_LEVELS.find((l) => l.key === eff)?.label}</Badge>
          </div>;
        })}
      </div>
    </section>

    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h3 className="font-medium">Follow-up types</h3>
      <ActionTypesEditor company={companyId} />
    </section>
  </div>;
}
