import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { MODULE_DESCRIPTIONS } from "@/lib/plan-features";
import { groupModules, moduleLabel } from "@/lib/module-categories";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

type Catalog = Database["public"]["Tables"]["platform_catalog"]["Row"];
type Sub = Database["public"]["Tables"]["platform_subscriptions"]["Row"];

/** Modules not yet sold in any active tier/pack, or flagged Coming soon, or given a release target. */
export function underConstruction(modules: string[], catalog: Catalog[], subs: Sub[], targeted: string[]) {
  const live = new Set(catalog.filter((c) => c.state === "active").flatMap((c) => c.modules));
  const soon = new Set(subs.flatMap((s) => s.coming_soon_modules ?? []));
  return modules.filter((m) => m !== "core" && (!live.has(m) || soon.has(m) || targeted.includes(m)));
}

export function HQUnderConstruction({ productId, catalog, modules, subscriptions }: { productId: string; catalog: Catalog[]; modules: string[]; subscriptions: Sub[] }) {
  const qc = useQueryClient();
  const key = ["hq-module-roadmap", productId];
  const q = useQuery({ queryKey: key, queryFn: async () => { const r = await supabase.from("platform_module_roadmap").select("*").eq("product_id", productId); if (r.error) throw r.error; return r.data; } });
  const rows = q.data ?? [];
  const list = underConstruction(modules, catalog, subscriptions, rows.filter((r) => r.targeted).map((r) => r.module));
  const save = async (module: string, patch: { targeted?: boolean; release_target?: string }) => {
    const cur = rows.find((r) => r.module === module);
    const r = await supabase.from("platform_module_roadmap").upsert({ product_id: productId, module, targeted: patch.targeted ?? cur?.targeted ?? false, release_target: (patch.release_target ?? cur?.release_target ?? "").slice(0, 40), updated_at: new Date().toISOString() });
    if (r.error) toast.error(r.error.message); else { toast.success("Saved"); void qc.invalidateQueries({ queryKey: key }); }
  };
  const status = (m: string) => {
    const tags: string[] = [];
    if (catalog.some((c) => c.state === "draft" && c.modules.includes(m))) tags.push("In draft pack");
    if (!catalog.some((c) => c.state === "active" && c.modules.includes(m))) tags.push("Not yet sold");
    const soon = subscriptions.filter((s) => s.coming_soon_modules?.includes(m)).length;
    if (soon) tags.push(`Coming soon for ${soon} compan${soon === 1 ? "y" : "ies"}`);
    return tags.length ? tags : ["Planned"];
  };
  if (q.error) return <p role="alert" className="text-destructive">{q.error.message}</p>;
  if (!list.length) return <p className="py-8 text-sm text-muted-foreground">No modules under construction. Every module is sold in an active tier or pack.</p>;
  return <div className="space-y-6">
    <p className="text-sm text-muted-foreground">Modules still in development. Switch on a release target to track it and note the milestone (e.g. Q1 2027).</p>
    {groupModules(list).map((g) => <section key={g.label} className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h3>
      <ul className="divide-y rounded-md border">{g.modules.map((m) => { const row = rows.find((r) => r.module === m); return <li key={m} className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-48 flex-1"><p className="font-medium">{moduleLabel(m)}</p>{MODULE_DESCRIPTIONS[m] && <p className="text-xs text-muted-foreground">{MODULE_DESCRIPTIONS[m]}</p>}<div className="mt-1 flex flex-wrap gap-1">{status(m).map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{t}</span>)}</div></div>
        <label className="flex items-center gap-2 text-sm"><Switch aria-label={`${moduleLabel(m)} release target`} checked={!!row?.targeted} onCheckedChange={(v) => void save(m, { targeted: v })} />Release target</label>
        <Input key={`${m}-${row?.release_target ?? ""}`} className="w-36" aria-label={`${moduleLabel(m)} target milestone`} placeholder="e.g. Q1 2027" maxLength={40} disabled={!row?.targeted} defaultValue={row?.release_target ?? ""} onBlur={(e) => { if (e.target.value !== (row?.release_target ?? "")) void save(m, { release_target: e.target.value }); }} />
      </li>; })}</ul>
    </section>)}
  </div>;
}
