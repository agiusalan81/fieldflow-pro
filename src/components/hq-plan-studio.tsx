import { Check, HardDrive, Minus, Pencil, Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { PLAN_FEATURES } from "@/lib/plan-features";
import { Button } from "@/components/ui/button";
import { isStorageAddon } from "@/lib/hq";
import { groupModules, sortModules } from "@/lib/module-categories";
import { Fragment } from "react";

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
          <th scope="col" className="sticky left-0 z-20 min-w-52 bg-muted p-3 text-left font-medium shadow-[inset_-1px_0_0_0_var(--color-border)]">Module</th>
          {tiers.map((t) => <th key={t.id} scope="col" className="min-w-28 p-3 text-center font-medium">{t.name}</th>)}
        </tr></thead>
        <tbody>{groupModules(modules).map((g) => <Fragment key={g.label}><tr className="border-b bg-muted/60"><th colSpan={tiers.length + 1} scope="colgroup" className="sticky left-0 p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</th></tr>{g.modules.map((m) => <tr key={m} className="border-b last:border-b-0">
          <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left font-normal shadow-[inset_-1px_0_0_0_var(--color-border)]">{featureLabel(m)}</th>
          {tiers.map((t) => <td key={t.id} className="p-3 text-center">
            {t.modules.includes(m)
              ? <Check className="mx-auto h-4 w-4 text-brand-amber" aria-label={`${t.name} includes ${featureLabel(m)}`} />
              : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label={`${t.name} does not include ${featureLabel(m)}`} />}
          </td>)}
        </tr>)}</Fragment>)}</tbody>
      </table>
    </div>
  </section>;
}

/** Pack cards with their module mix, plus a builder entry point. */
export function HQPackBuilder({ catalog, money, onEdit, onNew }: {
  catalog: Catalog[]; money: (v: number) => string; onEdit: (item: Catalog) => void; onNew: () => void;
}) {
  const packs = catalog.filter((c) => c.kind === "pack" && !isStorageAddon(c)).sort((a, b) => a.sort_order - b.sort_order);
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
          {sortModules(p.modules).map((m) => <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs">{featureLabel(m)}</span>)}
        </div>
      </article>)}
    </div>
  </section>;
}

export function HQStorageAddons({ catalog, money, onEdit }: {
  catalog: Catalog[]; money: (v: number) => string; onEdit: (item: Catalog) => void;
}) {
  const addons = catalog.filter(isStorageAddon).sort((a, b) => a.sort_order - b.sort_order);
  if (!addons.length) return null;
  return <section className="space-y-4" aria-label="Storage add-ons">
    <h3 className="font-semibold">Storage add-ons</h3>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {addons.map(item => <article key={item.id} className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <HardDrive className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Button size="icon" variant="ghost" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Pencil className="h-4 w-4" /></Button>
        </div>
        <h4 className="mt-2 font-semibold">{item.name}</h4>
        <p className="text-xs capitalize text-muted-foreground">{item.state}</p>
        <p className="mt-3 text-lg font-semibold">+{item.storage_gb} GB</p>
        <p className="mt-2 text-sm font-medium">{money(Number(item.monthly_price ?? 0))} / month</p>
        <p className="mt-1 text-xs text-muted-foreground">{money(Number(item.quarterly_price ?? 0))} / quarter</p>
        <p className="text-xs text-muted-foreground">{money(Number(item.yearly_price ?? 0))} / year</p>
        <p className="mt-2 text-xs text-muted-foreground">{item.billing_basis === "per_user" ? "Per user" : "Per company"}</p>
      </article>)}
    </div>
  </section>;
}
