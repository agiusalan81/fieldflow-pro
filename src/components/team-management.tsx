import { useServerFn } from "@tanstack/react-start";
import { sendInviteEmail } from "@/lib/invites.functions";
import { RegisteredMembers } from "@/components/registered-members";
import { CompanySeatStatus } from '@/components/company-seat-status';
import { useSeatUsage } from '@/lib/tenant-capacity';
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Mail, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useProfile, type Role } from "@/lib/profile";
import { payrollUiVisible } from "@/lib/payroll";
import { productLink } from "@/lib/platform";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const invitable = (r: Role): Role[] => r === "superuser" ? ["technician", "maintenance", "supervisor", "admin", "superuser"] : r === "admin" ? ["technician", "maintenance", "supervisor", "admin"] : r === 'supervisor' ? ["technician", "maintenance", "supervisor"] : [];

export function TeamManagement({ role, companyId, meId, tab }: { role: Role; companyId: string; meId: string; tab: "roster" | "invites" }) {
  const qc = useQueryClient();
  const capacity = useSeatUsage(companyId);
  const invitationBlocked = !capacity.data || !!capacity.error || capacity.data.available_seats === 0;
  const [inv, setInv] = useState({ role: "technician" as Role, full_name: "", email: "" });
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendInvite = useServerFn(sendInviteEmail);
  const deliver = async (token: string) => {
    setSending(true);
    try {
      const r = await sendInvite({ data: { token } });
      if (r.sent) toast.success(`Invitation sent to ${r.to}`);
      else toast.warning("Email delivery is blocked for this recipient. You can copy the invitation link.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Invitation email failed — copy the link instead"); }
    finally { setSending(false); }
  };
  const canEditRoles = role === "superuser" || role === "admin";
  const payrollVisible = payrollUiVisible(useProfile().data);
  const { data } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [u, r, i] = await Promise.all([
        supabase.from("users").select("id, full_name, email, employee_id").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("company_invites").select("*").is("used_at", null).order("created_at", { ascending: false }),
      ]);
      if (u.error || r.error || i.error) throw u.error || r.error || i.error;
      return { users: u.data ?? [], roles: new Map((r.data ?? []).map((x) => [x.user_id, x.role as Role])), invites: i.data ?? [] };
    },
  });
  const { data: product } = useQuery({ queryKey: ["invite-company-product", companyId], queryFn: async () => {
    const id = await supabase.rpc('company_product_id', { _company: companyId });
    if (id.error) throw id.error;
    if (!id.data) return null;
    const result = await supabase.from('platform_products').select('app_url').eq('id', id.data).single();
    if (result.error) throw result.error;
    return result.data;
  } });
  const link = (t: string) => productLink(product?.app_url ?? "", `/join/${t}`, window.location.origin);
  const copy = async (t: string) => { await navigator.clipboard.writeText(link(t)); toast.success("Invite link copied"); };
  const create = async (email: boolean) => {
    if (sending || invitationBlocked) return;
    const address = inv.email.trim().toLowerCase();
    if ((email || address) && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) { toast.error("Enter a valid recipient email address"); return; }
    setSending(true);
    try {
      const { data: row, error } = await supabase.from("company_invites").insert({ company_id: companyId, role: inv.role, full_name: inv.full_name || null, email: address || null }).select("token").single();
      if (error) throw error;
      setCreatedToken(row.token);
      await Promise.all([qc.invalidateQueries({ queryKey: ["team"] }), qc.invalidateQueries({ queryKey: ['company-seat-usage'] })]);
      if (email) await deliver(row.token);
      else await copy(row.token).catch(() => toast.success("Invitation created — the link is shown below"));
    } catch (e) { toast.error((e as {message?: string})?.message ?? "Invitation could not be created"); void capacity.refetch(); }
    finally { setSending(false); }
  };
  const revoke = async (id: string) => {
    const { error } = await supabase.from("company_invites").delete().eq("id", id);
    if (error) toast.error(error.message); else { void qc.invalidateQueries({ queryKey: ["team"] }); void qc.invalidateQueries({ queryKey: ['company-seat-usage'] }); }
  };
  const changeRole = async (userId: string, r: Role) => {
    const { error } = await supabase.from("user_roles").update({ role: r }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["team"] });
  };
  return (
    <div className="space-y-5">
      <CompanySeatStatus companyId={companyId} canManagePlan={role === 'superuser'} />
      {tab === "invites" && <section className="space-y-3 rounded-lg border bg-card p-5">
        <h2 className="flex items-center gap-2 font-medium text-foreground"><Link2 className="h-4 w-4" />Invite a team member</h2>
        <p className="text-sm text-muted-foreground">Send the link to a new team member. They sign in with Google, Microsoft or a password and join with the role you choose. Links expire after 14 days and work once. Employee IDs are created automatically.</p>
        <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
          <Select value={inv.role} onValueChange={(v) => setInv({ ...inv, role: v as Role })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{invitable(role).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-11" placeholder="Name (optional)" value={inv.full_name} onChange={(e) => setInv({ ...inv, full_name: e.target.value })} />
          <Input className="h-11" type="email" aria-label="Invite recipient email" placeholder="Recipient email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2"><Button disabled={sending || invitationBlocked} onClick={() => void create(true)}><Mail className="mr-1 h-4 w-4" />{sending ? "Sending…" : "Create & email invite"}</Button><Button variant="outline" disabled={sending || invitationBlocked} onClick={() => void create(false)}><Copy className="mr-1 h-4 w-4" />Create & copy link only</Button></div>
        {createdToken && <div className="space-y-2"><Label htmlFor="created-invite-link">Invitation link</Label><Input id="created-invite-link" readOnly value={link(createdToken)} /><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void copy(createdToken)}>Copy link</Button><Button variant="outline" size="sm" disabled={sending} onClick={() => void deliver(createdToken)}>Retry email</Button></div></div>}
        {data?.invites.length ? (
          <ul className="divide-y rounded-lg border">
            {data.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{i.full_name || i.email || "Open invite"} · {ROLE_LABEL[i.role as Role]} · expires {new Date(i.expires_at).toLocaleDateString()}</span>
                {i.email && new Date(i.expires_at).getTime() > Date.now() && <Button size="sm" variant="outline" disabled={sending} onClick={() => void deliver(i.token)}><Mail className="mr-1 h-3.5 w-3.5" />Send email</Button>}
                <Button size="sm" variant="outline" onClick={() => copy(i.token)}><Copy className="mr-1 h-3.5 w-3.5" />Copy</Button>
                <Button size="icon" variant="ghost" aria-label="Revoke invite" onClick={() => revoke(i.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>}
      {tab === "roster" && <RegisteredMembers role={role} meId={meId}/>}
    </div>
  );
}

