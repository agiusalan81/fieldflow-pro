import { useServerFn } from "@tanstack/react-start";
import { sendInviteEmail } from "@/lib/invites.functions";
import { RegisteredMembers } from "@/components/registered-members";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useProfile, type Role } from "@/lib/profile";
import { payrollUiVisible } from "@/lib/payroll";
import { companyProduct, productLink } from "@/lib/platform";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const invitable = (r: Role): Role[] => r === "superuser" ? ["technician", "maintenance", "supervisor", "admin", "superuser"] : r === "admin" ? ["technician", "maintenance", "supervisor", "admin"] : r === 'supervisor' ? ["technician", "maintenance", "supervisor"] : [];

export function TeamManagement({ role, companyId, meId, tab }: { role: Role; companyId: string; meId: string; tab: "roster" | "invites" }) {
  const qc = useQueryClient();
  const [inv, setInv] = useState({ role: "technician" as Role, full_name: "", email: "" });
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [sending, setSending] = useState(false);
  const sendInvite = useServerFn(sendInviteEmail);
  const emailInvite = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail)) { toast.error("Enter the recipient email address"); return; }
    const { data: row, error } = await supabase.from("company_invites").insert({ company_id: companyId, role: inv.role, full_name: inv.full_name || null, email: deliveryEmail.trim().toLowerCase() }).select("token").single();
    if (error) { toast.error(error.message); return; }
    setSending(true);
    try { const r = await sendInvite({ data: { token: row.token, link: link(row.token) } }); toast.success(`Invitation sent to ${r.to}`); setDeliveryEmail(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Invitation email failed — copy the link instead"); }
    finally { setSending(false); }
    qc.invalidateQueries({ queryKey: ["team"] });
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
  const { data: product } = useQuery({ queryKey: ["company-app-product"], queryFn: async () => companyProduct((await supabase.from("platform_products").select("slug, active, app_url")).data ?? []) });
  const link = (t: string) => productLink(product?.app_url ?? "", `/join/${t}`, window.location.origin);
  const copy = async (t: string) => { await navigator.clipboard.writeText(link(t)); toast.success("Invite link copied"); };
  const create = async () => {
    const { data: row, error } = await supabase.from("company_invites").insert({ company_id: companyId, role: inv.role, full_name: inv.full_name || null, email: inv.email || null }).select("token").single();
    if (error) { toast.error(error.message); return; }
    await copy(row.token).catch(() => toast.success("Invite link created"));
    setInv({ ...inv, full_name: "", email: "" });
    qc.invalidateQueries({ queryKey: ["team"] });
  };
  const revoke = async (id: string) => {
    const { error } = await supabase.from("company_invites").delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["team"] });
  };
  const changeRole = async (userId: string, r: Role) => {
    const { error } = await supabase.from("user_roles").update({ role: r }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["team"] });
  };
  return (
    <div className="space-y-5">
      {tab === "invites" && <section className="space-y-3 rounded-lg border bg-card p-5">
        <h2 className="flex items-center gap-2 font-medium text-foreground"><Link2 className="h-4 w-4" />Create a join link</h2>
        <p className="text-sm text-muted-foreground">Send the link to a new team member. They sign in with Google, Microsoft or a password and join with the role you choose. Links expire after 14 days and work once. Employee IDs are created automatically.</p>
        <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Select value={inv.role} onValueChange={(v) => setInv({ ...inv, role: v as Role })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{invitable(role).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-11" placeholder="Name (optional)" value={inv.full_name} onChange={(e) => setInv({ ...inv, full_name: e.target.value })} />
          <Input className="h-11" type="email" placeholder="Email (optional)" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />
          <Button className="h-11" onClick={create}>Create & copy link</Button>
        </div>
        <div className="flex flex-wrap gap-2"><Input className="h-11 sm:max-w-sm" type="email" aria-label="Invite delivery email" placeholder="Recipient email (they register with this address)" value={deliveryEmail} onChange={e=>setDeliveryEmail(e.target.value)}/><Button variant="outline" disabled={sending} onClick={emailInvite}>{sending ? "Sending…" : "Email invite"}</Button></div>
        {data?.invites.length ? (
          <ul className="divide-y rounded-lg border">
            {data.invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{i.full_name || i.email || "Open invite"} · {ROLE_LABEL[i.role as Role]} · expires {new Date(i.expires_at).toLocaleDateString()}</span>
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

