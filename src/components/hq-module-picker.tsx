import { useState } from "react";
import { MODULE_LAYERS, filterModules, groupModules, moduleLabel, type ModuleLayer } from "@/lib/module-categories";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
export function HQModulePicker({ modules, selected, tier, onChange }: { modules: string[]; selected: string[]; tier: boolean; onChange: (modules: string[]) => void }) {
  const [layer, setLayer] = useState<ModuleLayer | "all">("all");
  return <div className="space-y-4">
    <Tabs value={layer} onValueChange={value => setLayer(value as ModuleLayer | "all")}><TabsList aria-label="Editor module layer" className="h-auto flex-wrap"><TabsTrigger value="all">All layers</TabsTrigger>{MODULE_LAYERS.map(item => <TabsTrigger key={item.key} value={item.key}>{item.label}</TabsTrigger>)}</TabsList></Tabs>
    {groupModules(filterModules(modules, layer)).map(group => <div key={group.label} className="space-y-2"><h4 className="text-xs font-semibold uppercase text-muted-foreground">{group.label}</h4><div className="grid gap-3 sm:grid-cols-2">{group.modules.map(key => <label key={key} className="flex items-start gap-2 text-sm"><Checkbox aria-label={moduleLabel(key)} disabled={tier && ["core", "customer_quotes"].includes(key)} checked={key === "customer_quotes" && tier ? selected.includes("core") : selected.includes(key)} onCheckedChange={value => onChange(value ? [...new Set([...selected, key])] : selected.filter(item => item !== key))} /><span className="min-w-0 break-words">{moduleLabel(key)}</span></label>)}</div></div>)}
  </div>;
}