import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { recentSuggestions } from "@/lib/entry-suggestions";

/** RLS supplies the tenant/read boundary. Cache keys also isolate account and company. */
export function useEntrySuggestions() {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["entry-suggestions", profile?.id, profile?.company_id],
    enabled: !!profile,
    staleTime: 60_000,
    queryFn: async () => {
      const [sheets, jobs] = await Promise.all([
        supabase.from("job_sheets").select("reported_fault, repairs_performed, pending_works_future_jobs, jobsheet_time_logs(daily_work_description), jobsheet_parts(part_description, unit)").order("created_at", { ascending: false }).limit(100),
        supabase.from("jobs").select("problem_summary").order("created_at", { ascending: false }).limit(100),
      ]);
      // Suggestions are optional; unavailable/offline sources must not block editing.
      return {
        faults: recentSuggestions((sheets.data ?? []).map(s => s.reported_fault)),
        work: recentSuggestions((sheets.data ?? []).flatMap(s => [...s.jobsheet_time_logs.map(l => l.daily_work_description), s.repairs_performed])),
        pending: recentSuggestions((sheets.data ?? []).map(s => s.pending_works_future_jobs)),
        parts: recentSuggestions((sheets.data ?? []).flatMap(s => s.jobsheet_parts.map(p => p.part_description))),
        units: recentSuggestions((sheets.data ?? []).flatMap(s => s.jobsheet_parts.map(p => p.unit))),
        problems: recentSuggestions((jobs.data ?? []).map(j => j.problem_summary)),
      };
    },
  });
}