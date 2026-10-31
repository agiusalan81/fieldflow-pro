import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Edition } from "@/lib/editions";
import { INDUSTRY_PREFIXES, prefixFor } from "@/lib/equipment-prefixes";

/** Industry default prefixes plus tenant overrides and custom equipment types. */
export function EquipmentPrefixEditor({ edition, enabled, value, separator, padding, onChange }: {
  edition: Edition; enabled: boolean; value: Record<string, string>; separator: string; padding: number;
  onChange: (p: { use_equipment_prefixes?: boolean; equipment_prefixes?: Record<string, string> }) => void;
}) {
  const [name, setName] = useState("");
  const names = [...new Set([...Object.keys(INDUSTRY_PREFIXES[edition]), ...Object.keys(value)])];
  const set = (k: string, v: string) => onChange({ equipment_prefixes: { ...value, [k]: v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) } });
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <Label className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={(v) => onChange({ use_equipment_prefixes: v })} />Use a prefix per equipment type (e.g. 3 fridges → FR{separator}{"1".padStart(padding, "0")}, FR{separator}{"2".padStart(padding, "0")}, FR{separator}{"3".padStart(padding, "0")})</Label>
      {enabled && <>
        <p className="text-xs text-muted-foreground">Defaults suit your industry. Change any prefix, or add your own equipment. Unlisted equipment gets a prefix from its name automatically.</p>
        <ul className="grid gap-2 sm:grid-cols-2">{names.map((k) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{k}</span>
            <Input aria-label={`${k} prefix`} className="w-24 font-mono" value={value[k] ?? prefixFor(k, edition)} onChange={(e) => set(k, e.target.value)} />
            {k in value && <Button type="button" variant="ghost" size="icon" aria-label={`Reset ${k}`} onClick={() => { const { [k]: _, ...rest } = value; onChange({ equipment_prefixes: rest }); }}><X className="h-3 w-3" /></Button>}
          </li>
        ))}</ul>
        <div className="flex gap-2 sm:max-w-sm">
          <Input aria-label="New equipment type" placeholder="Add your own equipment…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Button type="button" variant="outline" disabled={!name.trim()} onClick={() => { set(name.trim(), prefixFor(name.trim(), edition, value)); setName(""); }}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </div>
      </>}
    </div>
  );
}
