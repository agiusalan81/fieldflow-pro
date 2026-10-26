import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { canEditCapabilities, showsFieldDispatchToggle, useFieldDispatchIds } from "@/lib/member-capabilities";

/** Secondary capabilities on top of a member's primary role. Primary role keeps payroll and rota. */
export function MemberCapabilities({ userId, role, actorRole, active }: { userId: string; role: string; actorRole: string; active: boolean }) {
  const qc = useQueryClient();
  const { data: ids } = useFieldDispatchIds();
  const [busy, setBusy] = useState(false);
  if (!showsFieldDispatchToggle(role) || !canEditCapabilities(actorRole, role)) return null;
  const on = ids?.has(userId) ?? false;
  const toggle = async (value: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_member_capabilities", { _user: userId, _field: value, _commercial: false });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(value ? "Can now be dispatched to jobs" : "Removed from field dispatch");
    await Promise.all([qc.invalidateQueries({ queryKey: ["member-capabilities"] }), qc.invalidateQueries({ queryKey: ["profile"] })]);
  };
  return <div className="rounded-md border p-3">
    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Operational capabilities</p>
    <label className="flex items-start justify-between gap-3 text-sm">
      <span><span className="font-medium text-foreground">Eligible for field dispatch</span><br /><span className="text-muted-foreground">Can be chosen as lead or assistant on visits and fill in job sheets. Payroll and rota stay on the primary role.</span></span>
      <Switch aria-label="Eligible for field dispatch" checked={on} disabled={busy || !active} onCheckedChange={toggle} />
    </label>
  </div>;
}
