import { Check, Minus, Pencil, Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { PLAN_FEATURES } from "@/lib/plan-features";
import { Button } from "@/components/ui/button";

type Catalog = Database["public"]["Tables"]["platform_catalog"]["Row"];

const featureLabel = (key: string) => PLAN_FEATURES.find((f) => f.key === key)?.label ?? key.replace(/_/g, " ");

/** Side-by-side tier cards plus an included/excluded comparison grid. */
export function HQTierComparison({ catalog, modules, money, onEdit }: {
  catalog: Catalog[]; modules: string[]; money: (v: number) => string; onEdit: (item: Catalog) => void;
}) {
  const tiers = catalog.filter((c) => c.kind === "plan" && c.state !== "archived").sort((a, b) => a.sort_order - b.sort_order);
  if (!tiers.length) return <p className="text-sm text-muted-foreground">No tiers yet. Add the first tier to start comparing packages.</p>;
  return <section className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {tiers.map((t) => <article key={t.id} className="flex flex-col rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div><h4 className="font-semibold">{t.name}</h4><p className="text-xs capitalize text-muted-foreground">{t.state}</p></div>
          <Button size="icon" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => onEdit(t)}><Pencil className="h-4 w-4" /></Button>
        </div>
        <p className="mt-2 text-lg font-semibold">{money(Number(t.monthly_price ?? 0))}<span className="text-xs font-normal text-muted-foreground"> / month</span></p>
        <p className="text-xs text-muted-foreground">{money(Number(t.quarterly_price ?? 0))} / quarter · {money(Number(t.yearly_price ?? 0))} / year</p>
        <p className="mt-2 text-xs text-muted-foreground">{t.included_seats} users · {t.storage_gb || 10} GB storage{t.billing_basis === "per_user" ? " · billed per user" : ""}</p>
        <p className="mt-3 text-xs font-medium">{t.modules.length} of {modules.length} modules included</p>
      </article>)}
    </div>
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Tier module comparison</caption>
        <thead><tr className="border-b bg-muted/40">
          <th scope="col" className="min-w-52 p-3 text-left font-medium">Module</th>
          {tiers.map((t) => <th key={t.id} scope="col" className="min-w-28 p-3 text-center font-medium">{t.name}</th>)}
        </tr></thead>
        <tbody>{modules.map((m) => <tr key={m} className="border-b last:border-b-0">
          <th scope="row" className="p-3 text-left font-normal">{featureLabel(m)}</th>
          {tiers.map((t) => <td key={t.id} className="p-3 text-center">
            {t.modules.includes(m)
              ? <Check className="mx-auto h-4 w-4 text-brand-amber" aria-label={`${t.name} includes ${featureLabel(m)}`} />
              : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label={`${t.name} does not include ${featureLabel(m)}`} />}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

/** Pack cards with their module mix, plus a builder entry point. */
export function HQPackBuilder({ catalog, money, onEdit, onNew }: {
  catalog: Catalog[]; money: (v: number) => string; onEdit: (item: Catalog) => void; onNew: () => void;
}) {
  const packs = catalog.filter((c) => c.kind === "pack").sort((a, b) => a.sort_order - b.sort_order);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">Module packs</h3><p className="text-xs text-muted-foreground">Bundles companies can add on top of their tier.</p></div>
      <Button variant="outline" onClick={onNew}><Plus className="mr-1 h-4 w-4" />Build a pack</Button>
    </div>
    {packs.length === 0 && <p className="text-sm text-muted-foreground">No packs yet. Build one to sell modules as add-ons.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {packs.map((p) => <article key={p.id} className="flex flex-col rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div><h4 className="font-semibold">{p.name}</h4><p className="text-xs capitalize text-muted-foreground">{p.state}</p></div>
          <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button>
        </div>
        <p className="mt-2 font-semibold">{money(Number(p.monthly_price ?? 0))}<span className="text-xs font-normal text-muted-foreground"> / month{p.billing_basis === "per_user" ? " per user" : ""}</span></p>
        {p.storage_gb > 0 && <p className="text-xs text-muted-foreground">+{p.storage_gb} GB storage</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.modules.length === 0 && <span className="text-xs text-muted-foreground">Storage-only pack</span>}
          {p.modules.map((m) => <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs">{featureLabel(m)}</span>)}
        </div>
      </article>)}
    </div>
  </section>;
}
