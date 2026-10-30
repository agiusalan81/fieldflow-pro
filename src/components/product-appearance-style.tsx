import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Edition } from "@/lib/editions";
import { appearanceCss, mergeAppearance } from "@/lib/product-appearance";

export function useProductAppearance(edition: Edition) {
  return useQuery({ queryKey: ["product-appearance", edition], staleTime: 60_000, queryFn: async () => {
    const { data } = await supabase.from("product_appearances").select("settings").eq("edition", edition).maybeSingle();
    return mergeAppearance(edition, data?.settings);
  } });
}

/** Injects the HQ-managed look for the active product edition. */
export function ProductAppearanceStyle({ edition }: { edition: Edition }) {
  const { data } = useProductAppearance(edition);
  if (!data) return null;
  return <style data-product-appearance={edition}>{appearanceCss(edition, data)}</style>;
}
