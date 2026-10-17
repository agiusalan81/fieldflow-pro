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
      return {
        rules, renewalDays: data?.renewal_notice_days ?? 30, industry: data?.industry ?? "", exists: !!data,
        idleTimeout: data?.idle_timeout_minutes ?? 30,
        breaks: { enabled: data?.break_enabled ?? true, count: data?.breaks_per_shift ?? 1, minutes: data?.break_minutes ?? 30 },
        standby: { start: data?.standby_start ?? new Date().toISOString().slice(0, 10), rotationDays: data?.standby_rotation_days ?? 7, perShift: data?.standby_per_shift ?? 1, order: data?.standby_order ?? [] },
        theme: { ...DEFAULT_THEME, ...((data?.theme ?? {}) as Partial<Typography>) },
        logo: data?.logo_data ?? "",
        phones: { office_phone: data?.office_phone ?? "", whatsapp_phone: data?.whatsapp_phone ?? "", emergency_phone: data?.emergency_phone ?? "", company_email: data?.company_email ?? "", company_address: data?.company_address ?? "" },
      };
    },
    staleTime: 60_000,
  });
}

export const EQUIPMENT_CATEGORIES = ["Elevator", "Escalator", "Custom"];

export const FONT_CHOICES: { value: string; label: string; css: string }[] = [
  { value: "default", label: "App default", css: "" },
  { value: "plex", label: "Plex Sans (clean)", css: '"IBM Plex Sans", system-ui, sans-serif' },
  { value: "grotesk", label: "Space Grotesk (modern)", css: '"Space Grotesk", system-ui, sans-serif' },
  { value: "archivo", label: "Archivo (strong)", css: '"Archivo", system-ui, sans-serif' },
  { value: "fraunces", label: "Fraunces (editorial)", css: '"Fraunces", Georgia, serif' },
  { value: "lora", label: "Lora (classic)", css: '"Lora", Georgia, serif' },
  { value: "mono", label: "Plex Mono (technical)", css: '"IBM Plex Mono", ui-monospace, monospace' },
];

export type TextStyle = { font: string; bold: boolean; italic: boolean; color: string };
export type Typography = { headers: TextStyle; fields: TextStyle };
export const DEFAULT_THEME: Typography = {
  headers: { font: "default", bold: false, italic: false, color: "" },
  fields: { font: "default", bold: false, italic: false, color: "" },
};

/** Writes the tenant's header/field styles to CSS variables read by styles.css. */
export function applyTypography(t: Typography | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  for (const [k, v] of [["head", t?.headers], ["field", t?.fields]] as const) {
    const font = FONT_CHOICES.find((f) => f.value === v?.font)?.css;
    const set = (n: string, val: string | undefined) => (val ? root.setProperty(`--tenant-${k}-${n}`, val) : root.removeProperty(`--tenant-${k}-${n}`));
    set("font", font || undefined);
    set("weight", v?.bold ? "700" : undefined);
    set("style", v?.italic ? "italic" : undefined);
    set("color", v?.color || undefined);
  }
}
