import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bold, Italic, Underline, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EDITIONS, EDITION_SPEC, type Edition } from "@/lib/editions";
import { FONTS, SWATCHES, ZONES, appearanceCss, defaultAppearance, type Palette, type ProductAppearance, type TextStyle, type ZoneKey } from "@/lib/product-appearance";
import { useProductAppearance } from "@/components/product-appearance-style";

const PALETTE: { key: keyof Palette; label: string }[] = [
  { key: "background", label: "Page & card background" }, { key: "fieldBackground", label: "Field background" }, { key: "fieldBorder", label: "Field border" },
  { key: "primary", label: "Accent / active" }, { key: "menuBackground", label: "Menu background" }, { key: "buttonBackground", label: "Button colour" }, { key: "buttonText", label: "Button text" },
];

function ColorPick({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <div className="flex flex-wrap items-center gap-1" aria-label={label}>
    <button type="button" aria-pressed={!value} disabled={!value} onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(""); }} className={`rounded border px-1.5 py-0.5 text-xs ${!value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted"}`}>Default</button>
    {SWATCHES.map(s => <button key={s} type="button" title={s} aria-label={`${label} ${s}`} onClick={() => onChange(s)} className={`h-5 w-5 rounded border ${value === s ? "ring-2 ring-ring ring-offset-1" : ""}`} style={{ backgroundColor: s }} />)}
    <input type="color" aria-label={`${label} custom`} value={value || "#000000"} onChange={e => onChange(e.target.value)} className={`h-6 w-8 cursor-pointer rounded border ${value && !SWATCHES.includes(value) ? "ring-2 ring-ring ring-offset-1" : ""}`} />
  </div>;
}

function Toolbar({ s, onChange }: { s: TextStyle; onChange: (p: Partial<TextStyle>) => void }) {
  const tog = (k: "bold" | "italic" | "underline", Icon: typeof Bold) => <Button type="button" size="icon" variant={s[k] ? "default" : "outline"} className="h-8 w-8" aria-pressed={s[k]} aria-label={k} onClick={() => onChange({ [k]: !s[k] })}><Icon className="h-4 w-4" /></Button>;
  return <div className="flex flex-wrap items-center gap-2">
    <select aria-label="Font" className="h-8 rounded-md border bg-background px-2 text-sm" value={s.font} onChange={e => onChange({ font: e.target.value })}>{FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
    <select aria-label="Size" className="h-8 rounded-md border bg-background px-2 text-sm" value={s.size} onChange={e => onChange({ size: Number(e.target.value) })}><option value={0}>Auto</option>{[11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32].map(n => <option key={n} value={n}>{n}px</option>)}</select>
    {tog("bold", Bold)}{tog("italic", Italic)}{tog("underline", Underline)}
    <ColorPick label="Text colour" value={s.color} onChange={color => onChange({ color })} />
  </div>;
}

export function HQAppearanceStudio() {
  const [edition, setEdition] = useState<Edition>("hotel");
  const { data } = useProductAppearance(edition);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2">
      {EDITIONS.map(e => <Button key={e} variant={e === edition ? "default" : "outline"} onClick={() => setEdition(e)}>{EDITION_SPEC[e].product}</Button>)}
    </div>
    {data ? <Editor key={edition} edition={edition} initial={data} /> : <p className="text-sm text-muted-foreground">Loading appearance…</p>}
  </div>;
}

function Editor({ edition, initial }: { edition: Edition; initial: ProductAppearance }) {
  const [a, setA] = useState<ProductAppearance | null>(() => structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  if (!a) return null;
  const zone = (k: ZoneKey, p: Partial<TextStyle>) => setA({ ...a, zones: { ...a.zones, [k]: { ...a.zones[k], ...p } } });
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("product_appearances").upsert({ edition, settings: a as never, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { toast.error("Could not save appearance"); return; }
    toast.success(`${EDITION_SPEC[edition].product} appearance saved`);
    void qc.invalidateQueries({ queryKey: ["product-appearance", edition] });
  };
  const previewCss = appearanceCss(edition, a).replaceAll(`html[data-edition="${edition}"]:not(.dark)`, ".appearance-preview");
  return <div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="min-w-0 space-y-5">
        <section className="space-y-3 rounded-md border bg-card p-4"><h3 className="font-semibold">Colour palette</h3>
          {PALETTE.map(p => <div key={p.key} className="space-y-1"><p className="text-sm font-medium">{p.label}</p><ColorPick label={p.label} value={a.palette[p.key]} onChange={v => setA({ ...a, palette: { ...a.palette, [p.key]: v } })} /></div>)}
        </section>
        <section className="space-y-4 rounded-md border bg-card p-4"><h3 className="font-semibold">Text styles</h3>
          {ZONES.map(z => <div key={z.key} className="space-y-1 border-b pb-3 last:border-0"><p className="text-sm font-medium">{z.label}</p><Toolbar s={a.zones[z.key]} onChange={p => zone(z.key, p)} /></div>)}
        </section>
        <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save & publish to app"}</Button><Button variant="outline" onClick={() => setA(defaultAppearance(edition))}><RotateCcw className="mr-1 h-4 w-4" />Reset to product default</Button></div>
      </div>
      <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <style>{previewCss}</style>
        <p className="mb-2 text-sm text-muted-foreground">Live preview</p>
        <div className="appearance-preview overflow-hidden rounded-md border" style={{ background: a.palette.background || undefined }}>
          <div className="tenant-menu space-y-1 border-b p-3" style={{ background: a.palette.menuBackground || undefined }}>
            <button type="button" className="block text-xs uppercase">Field work</button>
            <a className="block text-sm">Job sheets</a><a className="block text-sm">Schedule</a>
          </div>
          <main className="space-y-3 p-4">
            <h2 className="text-lg">Room 204 · AC fault</h2>
            <div className="space-y-1"><Label>Room & facility item</Label><Input readOnly value="Room 204 AC unit" style={{ backgroundColor: a.palette.fieldBackground || undefined }} /></div>
            <div className="space-y-1"><Label>Problem reported</Label><Input readOnly value="Not cooling, noisy fan" style={{ backgroundColor: a.palette.fieldBackground || undefined }} /></div>
            <Button type="button">Save job sheet</Button>
          </main>
        </div>
      </div>
    </div>
  </div>;
}
