import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PublicCatalogItem = {
  id: string;
  name: string;
  kind: string;
  sort_order: number;
  monthly_price: number | null;
  quarterly_price: number | null;
  yearly_price: number | null;
  included_seats: number;
  storage_gb: number;
  billing_basis: string;
  modules: string[];
};

export type PublicCatalog = { plans: PublicCatalogItem[]; packs: PublicCatalogItem[]; trialDays: number; error?: string };

/**
 * Public, unauthenticated read of the active pricing catalogue for the marketing site.
 * Rows are limited server-side by the `catalog_public_read` anon policy (state = 'active').
 */
export const listPublicCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<PublicCatalog> => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    // Opaque sb_ keys aren't JWTs; send only apikey, not the default Authorization bearer.
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabasePublic
    .from("platform_catalog")
    .select("id, name, kind, sort_order, monthly_price, quarterly_price, yearly_price, included_seats, storage_gb, billing_basis, modules")
    .eq("state", "active")
    .order("sort_order");
  // Live product settings (trial length) so the marketing site always matches HQ.
  const { data: product } = await supabasePublic
    .from("platform_products")
    .select("trial_days")
    .eq("slug", "fieldbridge")
    .eq("active", true)
    .maybeSingle();
  const trialDays = product?.trial_days ?? 60;
  if (error) return { plans: [], packs: [], trialDays, error: "Catalog unavailable" };
  const items: PublicCatalogItem[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    sort_order: r.sort_order,
    monthly_price: r.monthly_price,
    quarterly_price: r.quarterly_price,
    yearly_price: r.yearly_price,
    included_seats: r.included_seats ?? 0,
    storage_gb: r.storage_gb ?? 0,
    billing_basis: r.billing_basis ?? "company",
    modules: r.modules ?? [],
  }));
  return { plans: items.filter((i) => i.kind === "plan"), packs: items.filter((i) => i.kind !== "plan"), trialDays };
});
