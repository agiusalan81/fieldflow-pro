import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const platformOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: owner } = await context.supabase.rpc("is_platform_owner");
  if (!owner) return { allowed: false as const, products: [], catalog: [], subscriptions: [], overrides: [], ledger: [], referrals: [], conversions: [], audit: [], companies: [] };
  const [products, catalog, subscriptions, overrides, ledger, referrals, conversions, audit, companies] = await Promise.all([
    context.supabase.from("platform_products").select("*").order("name"), context.supabase.from("platform_catalog").select("*").order("sort_order"), context.supabase.from("platform_subscriptions").select("*"), context.supabase.from("platform_overrides").select("*"), context.supabase.from("platform_ledger").select("*").order("entry_date", { ascending: false }), context.supabase.from("platform_referrals").select("*"), context.supabase.from("platform_conversions").select("*"), context.supabase.from("platform_audit").select("*").order("created_at", { ascending: false }).limit(100),
    // This is a deliberately narrow, separately authorized platform directory RPC, not tenant business reads.
    context.supabase.rpc("platform_company_directory"),
  ]);
  const error = [products, catalog, subscriptions, overrides, ledger, referrals, conversions, audit, companies].find((r) => r.error)?.error;
  if (error) throw new Error(error.message);
  return { allowed: true as const, products: products.data ?? [], catalog: catalog.data ?? [], subscriptions: subscriptions.data ?? [], overrides: overrides.data ?? [], ledger: ledger.data ?? [], referrals: referrals.data ?? [], conversions: conversions.data ?? [], audit: audit.data ?? [], companies: companies.data ?? [] };
});