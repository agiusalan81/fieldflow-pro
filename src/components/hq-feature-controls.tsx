import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PLAN_FEATURES, MODULE_DESCRIPTIONS } from "@/lib/plan-features";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { isStorageAddon } from "@/lib/hq";

type Catalog = Database["public"]["Tables"]["platform_catalog"]["Row"];
type Subscription = Database["public"]["Tables"]["platform_subscriptions"]["Row"];
function useCommercialRefresh() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all(["platform-hq", "plan-features", "company-commercial"].map(key => qc.invalidateQueries({ queryKey: [key] })));
    toast.success("Saved");
  };
}
export function HQFeatureMatrix({ catalog, modules, onEdit }: { catalog: Catalog[]; modules: string[]; onEdit: (item: Catalog) => void }) {
  catalog = catalog.filter(item => !isStorageAddon(item));
  const refresh = useCommercialRefresh();
  const mutation = useMutation({
    mutationFn: async (input: { id: string; module: string; enabled: boolean }) => {
      const { error } = await supabase.rpc("set_catalog_module", { _catalog: input.id, _module: input.module, _enabled: input.enabled });
      if (error) throw error;
    },
    onSuccess: refresh, onError: (error) => toast.error(error.message),
  });
  const features = [...PLAN_FEATURES.filter(f => modules.includes(f.key)), ...modules.filter(m => !PLAN_FEATURES.some(f => f.key === m)).map(key => ({ key, label: key }))];
  if (!catalog.length) return null;
  return <div className="overflow-x-auto border"><table className="w-full border-collapse text-sm">
    <caption className="sr-only">Tier and pack feature composition</caption>
    <thead><tr className="border-b bg-muted/40"><th scope="col" className="sticky left-0 z-20 min-w-64 bg-muted p-4 text-left shadow-[inset_-1px_0_0_0_var(--color-border)]">Features</th>{catalog.map(item => <th key={item.id} scope="col" className="min-w-36 p-3 text-center"><Button variant="ghost" size="sm" onClick={() => onEdit(item)}>{item.name}</Button><p className="font-normal text-xs capitalize text-muted-foreground">{item.kind === "plan" ? "Tier" : "Pack"} · {item.state}</p></th>)}</tr></thead>
    <tbody>{features.map(feature => <tr key={feature.key} className="border-b last:border-b-0"><th scope="row" className="sticky left-0 z-10 bg-card p-4 text-left font-medium shadow-[inset_-1px_0_0_0_var(--color-border)]">{feature.label}{MODULE_DESCRIPTIONS[feature.key] && <p className="mt-1 max-w-sm text-xs font-normal text-muted-foreground">{MODULE_DESCRIPTIONS[feature.key]}</p>}</th>{catalog.map(item => <td key={item.id} className="p-3 text-center"><Switch aria-label={`${item.name}: ${feature.label}`} checked={item.modules.includes(feature.key)} disabled={mutation.isPending || (feature.key === "core" && item.kind === "plan")} onCheckedChange={enabled => mutation.mutate({ id: item.id, module: feature.key, enabled })} /></td>)}</tr>)}</tbody>
  </table></div>;
}
export function HQCompanyPacks({ subscription, packs, companyName }: { subscription: Subscription; packs: Catalog[]; companyName: string }) {
  const refresh = useCommercialRefresh();
  const mutation = useMutation({
    mutationFn: async (input: { id: string; enabled: boolean }) => {
      const { error } = await supabase.rpc("set_subscription_pack", { _subscription: subscription.id, _pack: input.id, _enabled: input.enabled });
      if (error) throw error;
    },
    onSuccess: refresh, onError: error => toast.error(error.message),
  });
  return <div className="grid min-w-44 gap-2 py-3">{packs.filter(p => p.state !== "archived" || subscription.pack_ids.includes(p.id)).map(pack => {
    const assigned = subscription.pack_ids.includes(pack.id);
    return <label key={pack.id} className="flex items-center gap-2 text-xs"><Switch aria-label={`${companyName}: ${pack.name} pack`} checked={assigned} disabled={mutation.isPending || (!assigned && pack.state !== "active")} onCheckedChange={enabled => mutation.mutate({ id: pack.id, enabled })} /><span>{pack.name}{pack.state !== "active" && <span className="ml-1 text-muted-foreground">({pack.state})</span>}</span></label>;
  })}{!packs.length && <span className="text-muted-foreground">—</span>}</div>;
}
