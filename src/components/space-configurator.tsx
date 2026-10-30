import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, X, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatableCombobox } from "@/components/creatable-combobox";
import { EDITION_SPEC, type Edition } from "@/lib/editions";
import { assetRows, buildSpaces, nextFloor, type Floor } from "@/lib/space-configurator";

const COPY = {
  hotel: { title: "Room & floor configurator", unit: "room", level: "Floor", zones: ["Standard King", "Deluxe Twin", "Executive Suite", "Penthouse", "Accessible room"], equipment: ["Air conditioning unit", "TV", "Minibar", "Safe", "Door lock / key card"], prefix: "Room " },
  retail: { title: "Store & department configurator", unit: "fixture bay", level: "Department", zones: ["Bakery", "Chilled / Dairy", "Frozen", "Produce", "Front of store / POS", "Back of house"], equipment: ["Multideck chiller", "Lighting"], prefix: "Bay " },
} as const;

export function SpaceConfigurator({ companyId, edition }: { companyId: string; edition: Extract<Edition, "hotel" | "retail"> }) {
  const c = COPY[edition];
  const qc = useQueryClient();
  const [siteId, setSiteId] = useState("");
  const [floors, setFloors] = useState<Floor[]>(() => [{ id: crypto.randomUUID(), label: edition === "hotel" ? "Floor 1" : "Bakery", start: 101, count: 10, zone: c.zones[0] }]);
  const [equipment, setEquipment] = useState<string[]>([...c.equipment]);
  const [pending, setPending] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const sites = useQuery({ queryKey: ["configurator-sites", companyId], queryFn: async () => {
    const r = await supabase.from("sites").select("id,name,client_id").order("name");
    if (r.error) throw r.error; return r.data;
  } });
  const spaces = useMemo(() => buildSpaces(floors, c.prefix), [floors, c.prefix]);
  const rows = useMemo(() => assetRows(spaces, equipment), [spaces, equipment]);
  const groups = EDITION_SPEC[edition].assetGroups;
  const zoneGroups = [{ group: edition === "hotel" ? "Room types" : "Departments", items: [...c.zones] }];
  const upd = (id: string, p: Partial<Floor>) => setFloors((fs) => fs.map((f) => f.id === id ? { ...f, ...p } : f));

  const populate = async () => {
    const site = sites.data?.find((s) => s.id === siteId);
    if (!site) { toast.error("Choose a property first"); return; }
    if (!rows.length) { toast.error("Nothing to create"); return; }
    setSaving(true);
    const { error } = await supabase.from("assets").insert(rows.map((r) => ({ ...r, company_id: companyId, client_id: site.client_id, site_id: site.id })));
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} items created`);
    setDone(true);
    qc.invalidateQueries({ queryKey: ["qr-generator-assets"] });
  };

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-medium text-foreground">{c.title}</h2>
        <p className="text-sm text-muted-foreground">Try a layout here first. Nothing is saved until you press “Create items”.</p>
      </div>
      <div className="space-y-1.5 sm:max-w-sm"><Label>Property / site</Label>
        <CreatableCombobox ariaLabel="Property" value={sites.data?.find((s) => s.id === siteId)?.name ?? ""} placeholder="Choose a property"
          groups={[{ group: "Sites", items: (sites.data ?? []).map((s) => s.name) }]}
          onChange={(name) => { const s = sites.data?.find((x) => x.name === name); if (s) setSiteId(s.id); else toast.error("Add new properties under Properties first"); }} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{c.level}s</h3>
        {floors.map((f) => (
          <div key={f.id} className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_6rem_6rem_auto]">
            <div className="space-y-1"><Label className="text-xs">{c.level} name</Label><Input className="h-11" value={f.label} onChange={(e) => upd(f.id, { label: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">{edition === "hotel" ? "Room type" : "Zone"}</Label><CreatableCombobox value={f.zone} groups={zoneGroups} onChange={(v) => upd(f.id, { zone: v })} /></div>
            <div className="space-y-1"><Label className="text-xs">First no.</Label><Input className="h-11" type="number" value={f.start} onChange={(e) => upd(f.id, { start: Number(e.target.value) || 1 })} /></div>
            <div className="space-y-1"><Label className="text-xs">How many</Label><Input className="h-11" type="number" min={0} max={500} value={f.count} onChange={(e) => upd(f.id, { count: Number(e.target.value) || 0 })} /></div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${f.label}`} disabled={floors.length === 1} onClick={() => setFloors((fs) => fs.filter((x) => x.id !== f.id))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setFloors((fs) => [...fs, nextFloor(fs, c.zones[0])])}><Plus className="mr-2 h-4 w-4" />Add {c.level.toLowerCase()}</Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Equipment in each {c.unit}</h3>
        <div className="flex flex-wrap gap-2">{equipment.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm">{e}
            <button type="button" aria-label={`Remove ${e}`} onClick={() => setEquipment((l) => l.filter((x) => x !== e))}><X className="h-3 w-3" /></button></span>
        ))}</div>
        <div className="sm:max-w-sm"><CreatableCombobox ariaLabel="Add equipment" value={pending} placeholder="Search or add equipment…" groups={groups}
          onChange={(v) => { setPending(""); setEquipment((l) => l.includes(v) ? l : [...l, v]); }} /></div>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">{floors.length} {c.level.toLowerCase()}s · {spaces.length} {c.unit}s · {rows.length} items</p>
        <div className="max-h-64 space-y-2 overflow-auto">{floors.map((f) => (
          <div key={f.id}><p className="text-xs text-muted-foreground">{f.label} · {f.zone}</p>
            <div className="flex flex-wrap gap-1">{spaces.filter((s) => s.floor === f.label).slice(0, 60).map((s, i) => <span key={i} className="rounded border bg-card px-2 py-0.5 text-xs">{s.name.replace(c.prefix, "")}</span>)}</div></div>
        ))}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="h-11" disabled={saving || !siteId} onClick={populate}>{saving ? "Creating…" : `Create ${rows.length} items`}</Button>
        {done && <Button asChild variant="outline" className="h-11"><Link to="/qr-codes"><QrCode className="mr-2 h-4 w-4" />Print QR codes</Link></Button>}
      </div>
    </section>
  );
}
