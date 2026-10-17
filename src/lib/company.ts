import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_RULES, type OvertimeRules } from "@/lib/jobsheets";

export function useCompanyRules() {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").maybeSingle();
      if (error) throw error;
      const rules: OvertimeRules = data
        ? { work_days: data.work_days, work_start: data.work_start.slice(0, 5), work_end: data.work_end.slice(0, 5), after_hours_rate: Number(data.after_hours_rate), saturday_rate: Number(data.saturday_rate), sunday_rate: Number(data.sunday_rate), holiday_rate: Number(data.holiday_rate), public_holidays: data.public_holidays }
        : DEFAULT_RULES;
      return { rules, renewalDays: data?.renewal_notice_days ?? 30, industry: data?.industry ?? "", exists: !!data };
    },
    staleTime: 60_000,
  });
}

export const EQUIPMENT_CATEGORIES = ["Elevator", "Escalator", "Custom"];
