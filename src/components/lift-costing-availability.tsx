import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { liftCostingAccess } from "@/lib/member-workspaces";
import { canEditCapabilities } from "@/lib/member-capabilities";

/** Lift pack: per-member "Available for: Lift costing sheets". The database enforces the same rule. */
export function LiftCostingAvailability({ userId, role }: { userId: string; role: string }) {
  const { data: me } = useProfile();
  const feature = usePlanFeatures(!!me);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const show = !!me && feature("lift_pack") && role !== "superuser" && canEditCapabilities(me.role, role);
  const q = useQuery({ queryKey: ["member-capabilities", userId, "lift-costing"], enabled: show, queryFn: async () => {
    const r = await supabase.from("user_roles").select("can_lift_costing").eq("user_id", userId).single(); if (r.error) throw r.error; return r.data;
  } });
  if (!show) return null;
  const on = liftCostingAccess(role, q.data?.can_lift_costing);
  const toggle = async (v: boolean) => {
    setBusy(true);
    const r = await supabase.rpc("set_member_lift_costing", { _user: userId, _enabled: v });
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(v ? "Lift costing sheets enabled" : "Lift costing sheets disabled");
    await Promise.all(["member-capabilities", "member-workspaces"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  };
  return <div className="mt-3 border-t pt-3"><p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Available for</p>
    <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Available for lift costing sheets" checked={on} disabled={busy || !q.data} onCheckedChange={(v) => void toggle(v === true)} />Lift costing sheets</label></div>;
}
