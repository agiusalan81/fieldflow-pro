import { RoleChangeControl } from "@/components/role-change-control";
import { Link } from "@tanstack/react-router";
import { usePayrollSetup, PayrollSetupAlert } from "@/components/payroll-setup-alert";
import { payrollUiVisible } from "@/lib/payroll";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldOff, RotateCcw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useProfile, type Role } from "@/lib/profile";
import { canManageMember, registrationDuration } from "@/lib/member-registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RegisteredMembers({ role, meId }: { role: Role; meId: string }) {
  const qc = useQueryClient();
  const payroll = usePayrollSetup();
  const payrollVisible = payrollUiVisible(useProfile().data);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [target, setTarget] = useState<{ id: string; full_name: string; active: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["registered-members"], queryFn: async () => {
    const { data, error } = await supabase.rpc("registered_members");
    if (error) throw error;
    return data;
  } });
  const change = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_member_access", { _user: target.id, _active: target.active, _reason: reason });
      if (error) throw error;
      toast.success(target.active ? "Access restored" : "Access revoked");
      setTarget(null); setReason("");
      await qc.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not change access"); }
    finally { setBusy(false); }
  };
  const members = (query.data ?? []).filter((u) => (filter === "all" || u.registration_status === filter) && `${u.full_name} ${u.email} ${u.employee_id}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-4">
    {payrollVisible && <PayrollSetupAlert />}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Team members ({query.data?.length ?? 0})</h2><div className="flex w-full flex-wrap gap-2 sm:w-auto"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Search members" placeholder="Search members" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"/></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All members</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="terminated">Terminated</SelectItem></SelectContent></Select></div></div>
    {query.isPending ? <p role="status">Loading members…</p> : query.isError ? <div role="alert"><p>Could not load registered members.</p><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div> : <ul className="divide-y rounded-lg border bg-card">{members.map((u) => <li key={u.id} className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-medium">{u.full_name} <span className="font-mono text-xs text-muted-foreground">{u.employee_id}</span></h3><p className="break-all text-sm text-muted-foreground">{u.email}</p></div><span className={u.registration_status === "active" ? "text-sm text-success" : "text-sm text-destructive"}>{u.registration_status === "active" ? "Active" : "Terminated"}</span></div><div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3"><p><RoleChangeControl member={u} actorRole={role} meId={meId}/><br/>{(u.providers ?? []).map((p) => p === "email" ? "Email / password" : p === "azure" ? "Microsoft" : p === "google" ? "Google" : p).join(", ") || "Not recorded"}</p><p>Registered {new Date(u.created_at).toLocaleString()}<br/>{registrationDuration(u.created_at, u.terminated_at)}</p><div>{u.terminated_at && <p>Revoked {new Date(u.terminated_at).toLocaleDateString()}<br/>{u.termination_reason}</p>}{canManageMember(role, meId, u) && <Button variant={u.registration_status === "active" ? "outline" : "secondary"} size="sm" onClick={() => { setReason(""); setTarget({ id: u.id, full_name: u.full_name, active: u.registration_status !== "active" }); }}>{u.registration_status === "active" ? <ShieldOff className="mr-2 h-4 w-4"/> : <RotateCcw className="mr-2 h-4 w-4"/>}{u.registration_status === "active" ? "Revoke access" : "Restore access"}</Button>}</div></div>{payrollVisible && <Button asChild variant="outline" size="sm"><Link to="/payroll/wages" search={{employee:u.id}}>{payroll.data?.configured.includes(u.id) ? "Edit payroll" : "Set up payroll"}</Link></Button>}</li>)}{members.length === 0 && <li className="p-5 text-muted-foreground">No matching members.</li>}</ul>}
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !busy) setTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{target?.active ? "Restore access" : "Revoke registration"}</DialogTitle></DialogHeader><p>{target?.full_name}</p><p className="text-sm text-muted-foreground">{target?.active ? "This member will regain access to your company." : "Company access will be blocked, including existing sessions. Past job sheets, payroll and other records remain unchanged."}</p><Label htmlFor="revocation-reason">Reason{target?.active ? " (optional)" : ""}</Label><Input id="revocation-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}/><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>Cancel</Button><Button variant={target?.active ? "default" : "destructive"} disabled={busy || (!target?.active && !reason.trim())} onClick={change}>{busy ? "Saving…" : target?.active ? "Restore access" : "Confirm revocation"}</Button></div></DialogContent></Dialog>
  </section>;
}