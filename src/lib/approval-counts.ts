import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager, isOffice } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { useCan } from "@/lib/permissions";

export type ApprovalCategory = "leave" | "expenses" | "equipment";

/** Pending review counts per Approvals category, limited to queues the manager may act on and modules that are on. */
export function useApprovalCounts() {
  const { data: p } = useProfile(); const on = usePlanFeatures(); const can = useCan(p);
  const allowed = !!p && isManager(p);
  const leaveOn = allowed && on("core") && can("leave_approvals");
  const expensesOn = allowed && on("receipts");
  const equipmentOn = allowed && isOffice(p) && on("core") && can("approvals");
  const passportOn=allowed&&on('lift_pack');
  const q = useQuery({
    queryKey: ["approval-counts", p?.id, leaveOn, expensesOn, equipmentOn,passportOn], enabled: allowed, refetchInterval: 30_000,
    queryFn: async () => {
      const zero = Promise.resolve({ count: 0, error: null });
      const [l, e, s, passports] = await Promise.all([
        leaveOn ? supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending") : zero,
        expensesOn ? supabase.from("expense_categories").select("id", { count: "exact", head: true }).eq("status", "pending") : zero,
        equipmentOn ? supabase.from("job_sheets").select("id", { count: "exact", head: true }).eq("requires_admin_approval", true) : zero,
        passportOn?supabase.from('passport_submissions').select('id',{count:'exact',head:true}).eq('status','pending'):zero,
      ]);
      const err = l.error ?? e.error ?? s.error??passports.error; if (err) throw err;
      return { leave: l.count ?? 0, expenses: e.count ?? 0, equipment: (s.count ?? 0)+(passports.count??0) } as Record<ApprovalCategory, number>;
    },
  });
  const counts = q.data ?? { leave: 0, expenses: 0, equipment: 0 };
  return { allowed, leaveOn, expensesOn, equipmentOn, counts, total: counts.leave + counts.expenses + counts.equipment };
}
