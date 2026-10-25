import { useState } from "react";
import { Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { filterModules, MODULE_LAYERS, groupModules, type ModuleLayer } from "@/lib/module-categories";
import { isStorageAddon } from "@/lib/hq";
import { HQFeatureMatrix } from "@/components/hq-feature-controls";
import { HQStorageAddons } from "@/components/hq-plan-studio";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";

type Catalog = Database["public"]["Tables"]["platform_catalog"]["Row"];
export function HQModuleStudio({ catalog, modules, money, onEdit, onNew }: {
  catalog: Catalog[]; modules: string[]; money: (v: number) => string;
  onEdit: (item: Catalog) => void; onNew: (kind: "plan" | "pack") => void;
}) {
  const [scope, setScope] = useState("plan");
  const [layer, setLayer] = useState<ModuleLayer | "all">("all");
  const [category, setCategory] = useState("all");
  const visibleCatalog = catalog.filter(item => item.kind === scope && !isStorageAddon(item))
    .sort((a, b) => a.sort_order - b.sort_order);
  const visibleModules = filterModules(modules, layer, category);
  return <section className="min-w-0 space-y-5" aria-label="Module composition">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={scope} onValueChange={setScope}><TabsList aria-label="Catalog comparison">
        <TabsTrigger value="plan">Tiers side by side</TabsTrigger>
        <TabsTrigger value="pack">Packs side by side</TabsTrigger>
      </TabsList></Tabs>
      <Button variant="outline" onClick={() => onNew(scope === "plan" ? "plan" : "pack")}><Plus className="mr-2 h-4 w-4" />{scope === "plan" ? "Add tier" : "Build a pack"}</Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={layer} onValueChange={value => { if (value === "all" || MODULE_LAYERS.some(l => l.key === value)) { setLayer(value as ModuleLayer | "all"); setCategory("all"); } }}>
        <TabsList aria-label="Module layer" className="h-auto flex-wrap">
          <TabsTrigger value="all">All layers</TabsTrigger>
          {MODULE_LAYERS.map(item => <TabsTrigger key={item.key} value={item.key}>{item.label}<span className="ml-2 text-xs text-muted-foreground">{filterModules(modules, item.key).length}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
      <NativeSelect aria-label="Module domain" className="w-full sm:w-64" value={category} onValueChange={setCategory}>
        <option value="all">All domains</option>
        {groupModules(filterModules(modules, layer)).map(group => <option key={group.label} value={group.label}>{group.label}</option>)}
      </NativeSelect>
    </div>
    {visibleCatalog.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No {scope === "plan" ? "tiers" : "module packs"} yet.</p> : visibleModules.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No modules in this selection.</p> : <HQFeatureMatrix catalog={visibleCatalog} modules={visibleModules} money={money} onEdit={onEdit} />}
    <HQStorageAddons catalog={catalog} money={money} onEdit={onEdit} />
  </section>;
}