import { LockKeyhole } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
export type BrandingOffer = { name: string; kind: string; modules: string[]; state: string };
export function offerNames(offers: BrandingOffer[], feature: string) { return offers.filter(o => o.modules.includes(feature)).map(o => o.kind === "pack" ? `${o.name} pack` : o.name); }
export function BrandingLock({ allowed, feature, children }: { allowed: boolean; feature: string; children: ReactNode }) {
  const { data = [] } = useQuery({ queryKey: ["branding-offers"], queryFn: async () => { const { data, error } = await supabase.rpc("branding_offers"); if (error) throw error; return data as BrandingOffer[]; }, staleTime: 30_000 });
  const names = offerNames(data, feature);
  return <div className="min-w-0 space-y-2">{!allowed && <p className="flex items-start gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 shrink-0" />{names.length ? `Available with ${names.join(" / ")}` : "Available with an included tier or pack — contact your account manager"}</p>}<fieldset disabled={!allowed} className={`min-w-0 space-y-3 ${allowed ? "" : "opacity-50"}`}>{children}</fieldset></div>;
}