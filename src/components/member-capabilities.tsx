import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { commercialAccess } from '@/lib/member-workspaces';
import { crmDefaultLevel } from '@/lib/crm';
import { LiftCostingAvailability } from "@/components/lift-costing-availability";
import { MemberVehicleSettings } from "@/components/vehicle-settings";
import { canEditCapabilities, showsFieldDispatchToggle } from "@/lib/member-capabilities";

/** Secondary capabilities on top of a member's primary role. Primary role keeps payroll and rota. */
export function MemberCapabilities({ userId, role, actorRole, active }: { userId: string; role: string; actorRole: string; active: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['member-capabilities', userId], queryFn: async () => { const r = await supabase.from('user_roles').select('can_field_dispatch,can_estimates,can_contracts,can_dispatch_jobs,can_site_surveys,crm_access').eq('user_id', userId).single(); if (r.error) throw r.error; return r.data; } });
  const [busy, setBusy] = useState(false);
  if (!canEditCapabilities(actorRole, role)) return null;
  const estimates = commercialAccess(role, 'estimates', data?.can_estimates);
  const contracts = commercialAccess(role, 'contracts', data?.can_contracts);
  const dispatch = commercialAccess(role, 'dispatch', data?.can_dispatch_jobs);
  const surveys = data?.can_site_surveys ?? !['superuser','admin'].includes(role);
  const crm = data?.crm_access ?? crmDefaultLevel(role);
  const toggle = async (patch: Partial<{ estimates: boolean; contracts: boolean; field: boolean; dispatch: boolean; surveys: boolean; crm: string }>) => {
    setBusy(true);
    const { error } = patch.surveys !== undefined ? await supabase.rpc("set_member_surveys", { _user: userId, _enabled: patch.surveys }) : patch.dispatch !== undefined ? await supabase.rpc("set_member_dispatch", { _user: userId, _enabled: patch.dispatch }) : await supabase.rpc("set_member_workspaces", { _user: userId, _field: patch.field ?? data?.can_field_dispatch ?? false, _estimates: patch.estimates ?? estimates, _contracts: patch.contracts ?? contracts, _crm: patch.crm ?? crm });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Member capabilities updated');
    await Promise.all(['member-capabilities', 'profile', 'member-workspaces', 'crm-access', 'crm-settings'].map(key => qc.invalidateQueries({ queryKey: [key] })));
  };
  return <div className="rounded-md border p-3">
    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Individual capabilities</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {showsFieldDispatchToggle(role) && <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Eligible for field dispatch" checked={data?.can_field_dispatch ?? false} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ field: v === true })} />Eligible for field dispatch</label>}
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Dispatch and scheduling capability" checked={dispatch} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ dispatch: v === true })} />Dispatch & scheduling</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Estimates and quotes capability" checked={estimates} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ estimates: v === true })} />Estimates & quotes</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Contracts and renewals capability" checked={contracts} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ contracts: v === true })} />Contracts & renewals</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Site surveys capability" checked={surveys} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ surveys: v === true })} />Site surveys</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="CRM capability" checked={crm !== 'none'} disabled={role === "superuser" || busy || !active || !data} onCheckedChange={v => void toggle({ crm: v === true ? 'contributor' : 'none' })} />CRM pipeline</label>
    </div>
    {crm !== 'none' && <div className="mt-3"><Select value={crm} disabled={role === "superuser" || busy || !active || !data} onValueChange={v => void toggle({ crm: v })}><SelectTrigger aria-label="CRM permission level"><SelectValue /></SelectTrigger><SelectContent>{['viewer','contributor','closer','manager'].map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select></div>}
    {active && <LiftCostingAvailability userId={userId} role={role} />}
    <MemberVehicleSettings userId={userId} active={active} />
  </div>;
}
