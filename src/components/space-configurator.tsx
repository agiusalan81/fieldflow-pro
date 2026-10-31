import { useMemo, useState, useEffect } from "react";
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
import { assetRows, buildSpaces, nextFloor, type Floor, type EquipmentBundle } from "@/lib/space-configurator";
import { suggestNextTag } from '@/lib/identifier-format';
import { prefixFor, sequenceTags } from '@/lib/equipment-prefixes';
import type { Json } from '@/integrations/supabase/types';

const COPY = {
  hotel: { title: "Room & floor configurator", unit: "room", level: "Floor", zones: ["Standard King", "Deluxe Twin", "Executive Suite", "Penthouse", "Accessible room"], equipment: ["Air conditioning unit", "TV", "Minibar", "Safe", "Door lock / key card"], prefix: "Room " },
  retail: { title: "Store & department configurator", unit: "area", level: "Department", zones: ["Pastry", "Production", "Sales floor", "Storage", "Preparation", "Back of house"], equipment: ["Fridge"], prefix: "Area " },
} as const;

export function SpaceConfigurator({ companyId, edition }: { companyId: string; edition: Extract<Edition, "hotel" | "retail"> }) {
  const c = COPY[edition];
  const qc = useQueryClient();
  const [siteId, setSiteId] = useState("");
  const [floors, setFloors] = useState<Floor[]>(() => [{ id: crypto.randomUUID(), label: edition === "hotel" ? "Floor 1" : "Bakery", start: edition==='hotel'?101:1, count: edition==='hotel'?10:1, zone: c.zones[0] }]);
  const [equipment, setEquipment] = useState<EquipmentBundle[]>(c.equipment.map(name=>({name,count:1})));
  const [pending, setPending] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [createdIds,setCreatedIds]=useState<string[]>([]);
  const rules=useQuery({queryKey:['identifier-rules',companyId,'asset'],queryFn:async()=>{const r=await supabase.from('company_identifier_rules').select('*').eq('kind','asset').maybeSingle();if(r.error)throw r.error;return r.data;}});
  const existing=useQuery({queryKey:['configurator-references',companyId],queryFn:async()=>{const tags:string[]=[];for(let offset=0;;offset+=500){const r=await supabase.from('assets').select('reference_number').order('id').range(offset,offset+499);if(r.error)throw r.error;tags.push(...r.data.map(a=>a.reference_number));if(r.data.length<500)return tags;}}});

  const sites = useQuery({ queryKey: ["configurator-sites", companyId], queryFn: async () => {
    const r = await supabase.from("sites").select("id,name,client_id").order("name");
    if (r.error) throw r.error; return r.data;
  } });
  useEffect(()=>{if(!siteId&&sites.data?.length===1){const first=sites.data[0];if(first)setSiteId(first.id);}},[sites.data,siteId]);
  const spaces = useMemo(() => buildSpaces(floors, c.prefix), [floors, c.prefix]);
  const rows = useMemo(() => { const base=assetRows(spaces, equipment); const r=rules.data; if(!r) return base; if(r.use_equipment_prefixes){ const prefixes=base.map(x=>prefixFor(x.asset_category,edition,(r.equipment_prefixes??{}) as Record<string,string>)); const tags=sequenceTags(prefixes,existing.data??[],r.separator,r.padding); return base.map((x,i)=>({...x,prefix:prefixes[i],reference_number:tags[i]??x.reference_number})); } return base.map((x,i)=>({...x,reference_number:suggestNextTag(existing.data??[],r,i+1)})); }, [spaces, equipment,rules.data,existing.data,edition]);
  const groups = EDITION_SPEC[edition].assetGroups;
  const zoneGroups = [{ group: edition === "hotel" ? "Room types" : "Departments", items: [...c.zones] }];
  const upd = (id: string, p: Partial<Floor>) => setFloors((fs) => fs.map((f) => f.id === id ? { ...f, ...p } : f));

  const populate = async () => {
    const site = sites.data?.find((s) => s.id === siteId);
    if (!site) { toast.error("Choose a property first"); return; }
    if (!rows.length) { toast.error("Nothing to create"); return; }
    setSaving(true);
    try{const {data,error}=await supabase.rpc('populate_space_assets',{_site:site.id,_rows:rows as unknown as Json});if(error)throw error;setCreatedIds(data);toast.success(`${data.length} items created`);setDone(true);await Promise.all(['qr-generator-assets','configurator-references'].map(key=>qc.invalidateQueries({queryKey:[key]})));}catch(e){toast.error((e as {message?:string})?.message??'Could not create items');}finally{setSaving(false);}
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-medium text-foreground">{c.title}</h2>
        <p className="text-sm text-muted-foreground">Try a layout here first. Nothing is saved until you press “Create items”.</p>
      </div>
      {rules.isSuccess && !rules.data && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">Step 1: set your asset ID format first</p>
          <p className="text-muted-foreground">Choose how tags look (e.g. FR-01, RM-001) so new items get unique numbers.</p>
          <Button asChild size="sm" variant="outline" className="mt-2"><Link to="/company" search={{ section: "asset-ids" }}>Set asset ID format</Link></Button>
        </div>
      )}
      {rules.data && rules.data.pattern_type !== "numeric" && <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">Your asset ID format must use a number sequence for automatic creation. <Link className="underline" to="/company" search={{ section: "asset-ids" }}>Change it</Link></p>}
      <div className="space-y-1.5 sm:max-w-sm"><Label>Property / site</Label>
        <CreatableCombobox ariaLabel="Property" value={sites.data?.find((s) => s.id === siteId)?.name ?? ""} placeholder="Choose a property"
          groups={[{ group: "Sites", items: (sites.data ?? []).map((s) => s.name) }]}
          onChange={(name) => { const s = sites.data?.find((x) => x.name === name); if (s) setSiteId(s.id); else toast.error("Add new properties under Properties first"); }} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{c.level}s</h3>
        {floors.map((f) => (
          <div key={f.id} className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_6rem_6rem_auto]">
            <div className="space-y-1"><Label className="text-xs">{c.level} name</Label><CreatableCombobox ariaLabel={`${c.level} name`} value={f.label} groups={[{group:c.level+'s',items:edition==='retail'?['Bakery','Chilled / Dairy','Frozen','Produce','Front of store / POS','Back of house']:floors.map(x=>x.label)}]} onChange={v=>upd(f.id,{label:v})}/></div>
            <div className="space-y-1"><Label className="text-xs">{edition === "hotel" ? "Room type" : "Zone"}</Label><CreatableCombobox ariaLabel={edition==='hotel'?'Room type':'Zone'} value={f.zone} groups={zoneGroups} onChange={(v) => upd(f.id, { zone: v })} /></div>
            <div className="space-y-1"><Label className="text-xs">First no.</Label><Input className="h-11" type="number" value={f.start} onChange={(e) => upd(f.id, { start: Number(e.target.value) || 1 })} /></div>
            <div className="space-y-1"><Label className="text-xs">How many</Label><Input className="h-11" type="number" min={0} max={500} value={f.count} onChange={(e) => upd(f.id, { count: Number(e.target.value) || 0 })} /></div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${f.label}`} disabled={floors.length === 1} onClick={() => setFloors((fs) => fs.filter((x) => x.id !== f.id))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setFloors((fs) => [...fs, {...nextFloor(fs, c.zones[0]),...(edition==='retail'?{label:`Department ${fs.length+1}`,start:1,count:1}:{})}])}><Plus className="mr-2 h-4 w-4" />Add {c.level.toLowerCase()}</Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Equipment in each {c.unit}</h3>
        <div className="flex flex-wrap gap-2">{equipment.map((e) => (
          <div key={e.name} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><span>{e.name}</span><Input className="w-20" aria-label={`${e.name} quantity`} type="number" min={0} max={500} value={e.count} onChange={event=>setEquipment(l=>l.map(x=>x.name===e.name?{...x,count:Number(event.target.value)}:x))}/><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${e.name}`} onClick={() => setEquipment((l) => l.filter((x) => x.name !== e.name))}><X className="h-3 w-3" /></Button></div>
        ))}</div>
        <div className="sm:max-w-sm"><CreatableCombobox ariaLabel="Add equipment" value={pending} placeholder="Search or add equipment…" groups={groups}
          onChange={(v) => { setPending(""); setEquipment((l) => l.some(e=>e.name===v) ? l : [...l, {name:v,count:1}]); }} /></div>
      </div>

      <ul aria-label="Asset preview" className="max-h-48 overflow-auto divide-y text-sm">{rows.slice(0,100).map((r,i)=><li key={i} className="py-2"><span className="font-mono">{r.reference_number}</span> · {r.asset_category}<p className="text-xs text-muted-foreground">{r.location_details}</p></li>)}</ul>

      <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">{floors.length} {c.level.toLowerCase()}s · {spaces.length} {c.unit}s · {rows.length} items</p>
        <div className="max-h-64 space-y-2 overflow-auto">{floors.map((f) => (
          <div key={f.id}><p className="text-xs text-muted-foreground">{f.label} · {f.zone}</p>
            <div className="flex flex-wrap gap-1">{spaces.filter((s) => s.floor === f.label).slice(0, 60).map((s, i) => <span key={i} className="rounded border bg-card px-2 py-0.5 text-xs">{s.name.replace(c.prefix, "")}</span>)}</div></div>
        ))}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={saving||done} onClick={populate}>{saving ? "Creating…" : done?'Items created':`Create ${rows.length} items`}</Button>
        {done && <Button asChild variant="outline" className="h-11"><Link to="/qr-codes" search={{site:siteId,assets:createdIds.join(',')}}><QrCode className="mr-2 h-4 w-4" />Print QR codes</Link></Button>}
      </div>
    </section>
  );
}
