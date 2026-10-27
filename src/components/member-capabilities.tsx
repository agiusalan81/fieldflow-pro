import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { commercialAccess } from '@/lib/member-workspaces';
import { crmDefault } from '@/lib/crm';
import { canEditCapabilities, showsFieldDispatchToggle } from "@/lib/member-capabilities";

/** Secondary capabilities on top of a member's primary role. Primary role keeps payroll and rota. */
export function MemberCapabilities({ userId, role, actorRole, active }: { userId: string; role: string; actorRole: string; active: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['member-capabilities', userId], queryFn: async () => { const r = await supabase.from('user_roles').select('can_field_dispatch,can_estimates,can_contracts,crm_access').eq('user_id', userId).single(); if (r.error) throw r.error; return r.data; } });
  const [busy, setBusy] = useState(false);
  if (!canEditCapabilities(actorRole, role)) return null;
  const estimates = commercialAccess(role, 'estimates', data?.can_estimates);
  const contracts = commercialAccess(role, 'contracts', data?.can_contracts);
  const crm = data?.crm_access ?? crmDefault(role);
  const toggle = async (patch: Partial<{ estimates: boolean; contracts: boolean; field: boolean; crm: string }>) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_member_workspaces", { _user: userId, _field: patch.field ?? data?.can_field_dispatch ?? false, _estimates: patch.estimates ?? estimates, _contracts: patch.contracts ?? contracts, _crm: patch.crm ?? crm });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Member capabilities updated');
    await Promise.all(['member-capabilities', 'profile', 'member-workspaces', 'crm-access', 'crm-settings'].map(key => qc.invalidateQueries({ queryKey: [key] })));
  };
  return <div className="rounded-md border p-3">
    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Individual capabilities</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {showsFieldDispatchToggle(role) && <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Eligible for field dispatch" checked={data?.can_field_dispatch ?? false} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ field: v === true })} />Eligible for field dispatch</label>}
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Estimates and quotes capability" checked={estimates} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ estimates: v === true })} />Estimates & quotes</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Contracts and renewals capability" checked={contracts} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ contracts: v === true })} />Contracts & renewals</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="CRM capability" checked={crm !== 'none'} disabled={busy || !active || !data} onCheckedChange={v => void toggle({ crm: v === true ? 'contributor' : 'none' })} />CRM pipeline</label>
    </div>
    {crm !== 'none' && <div className="mt-3"><Select value={crm} disabled={busy || !active || !data} onValueChange={v => void toggle({ crm: v })}><SelectTrigger aria-label="CRM permission level"><SelectValue /></SelectTrigger><SelectContent>{['viewer','contributor','closer','manager'].map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select></div>}
  </div>;
}
