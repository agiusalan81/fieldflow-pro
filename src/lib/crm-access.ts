import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmLevel } from "@/lib/crm";

/** Caller's effective CRM level from the database (never trusted for writes; RLS enforces). */
export function useCrmAccess(enabled = true) {
  return useQuery({
    queryKey: ["crm-access"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await supabase.rpc("my_crm_access");
      if (r.error) throw r.error;
      return ((r.data as string | null) ?? "none") as CrmLevel;
    },
  });
}
