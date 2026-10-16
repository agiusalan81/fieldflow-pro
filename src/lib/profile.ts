import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  role: "admin" | "technician" | "supervisor";
  companies: { name: string } | null;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("users")
        .select("id, company_id, full_name, email, role, companies(name)")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    staleTime: 60_000,
  });
}

export const isManager = (p?: Profile | null) => p?.role === "admin" || p?.role === "supervisor";

export function useCompanyUsers() {
  return useQuery({
    queryKey: ["company-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("id, full_name, role").order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

export function hoursBetween(a?: string | null, b?: string | null) {
  if (!a) return 0;
  const end = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, (end - new Date(a).getTime()) / 3_600_000);
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_transit: "In transit",
  in_progress: "In progress",
  completed: "Completed",
};
