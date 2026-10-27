import { useRef } from "react";
import { ArrowDown, ArrowUp, Camera, Plus, Trash2 } from "lucide-react";
import { checklistRows, DEFAULT_CHOICES, DEFAULT_SPEC, rowsFromText, FIELD_CONTROLS, moveChecklistRow, type BlockAudience, type FieldControl, type FieldSpec } from "@/lib/document-blocks";
import { FormatToolbar } from "@/components/format-toolbar";
import { RichText } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import { UnitSelect } from "@/components/unit-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ChecklistRowEditor({ items, specs, onChange }: { items: string[]; specs: FieldSpec[]; onChange: (items: string[], specs: FieldSpec[]) => void }) {
  const rows = checklistRows(items, specs);
  const area = useRef<HTMLTextAreaElement>(null);
  const setRows = (next: typeof rows) => onChange(next.map(row => row.item), next.map(row => row.spec));
  const update = (index: number, item: string, spec: FieldSpec) => setRows(rows.map((row, i) => i === index ? { item, spec } : row));
  const setText = (text: string) => { const next = rowsFromText(text, rows.map(r => r.spec)); onChange(next.items, next.specs); };
  return <div className="space-y-2"><Label htmlFor="checklist-text">Checklist steps</Label>
    <p className="text-xs text-muted-foreground">Type one step per line — each line becomes a row. Select text, then use the toolbar to format it.</p>
    <FormatToolbar target={area} onText={setText} />
    <Textarea ref={area} id="checklist-text" className="font-mono text-sm" rows={Math.max(4, items.length + 1)} value={items.join("\n")} onChange={e => setText(e.target.value)} placeholder={"Check brake operation\nInspect landing doors\nTest alarm button"} />
    <Label>Controls per step</Label>
    {rows.map((row, i) => <div key={i} className="space-y-2 rounded-lg border p-2">
      <div className="flex min-w-0 items-center gap-1"><span className="w-6 shrink-0 text-sm text-muted-foreground">{i + 1}.</span><Input aria-label={`Checklist step ${i + 1}`} placeholder="Step description" value={row.item} onChange={e => update(i, e.target.value, row.spec)} /></div>
      {row.item.trim() && <p className="pl-7 text-xs text-muted-foreground"><RichText text={row.item} /></p>}
      <div className="grid gap-2 sm:grid-cols-2"><Select value={row.spec.control} onValueChange={v => update(i, row.item, { ...row.spec, control: v as FieldControl, ...(v === "choice" && !row.spec.options?.length ? { options: [...DEFAULT_CHOICES] } : {}) })}><SelectTrigger aria-label={`Control for step ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent>{FIELD_CONTROLS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent></Select><Select value={row.spec.audience} onValueChange={v => update(i, row.item, { ...row.spec, audience: v as BlockAudience })}><SelectTrigger aria-label={`Visibility for step ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Both copies</SelectItem><SelectItem value="technician">Technician only</SelectItem><SelectItem value="client">Client only</SelectItem></SelectContent></Select></div>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-32" type="number" min={0} step="0.01" aria-label={`Client price for step ${i + 1}`} placeholder="Client price €" value={row.spec.price ?? ""} onChange={e => { const n = Number(e.target.value); const { price: _p, ...rest } = row.spec; update(i, row.item, e.target.value && n > 0 ? { ...rest, price: n } : rest); }} />
        <label className="flex items-center gap-1 text-xs"><Camera className="h-3.5 w-3.5" />Photos<Switch aria-label={`Allow photos for step ${i + 1}`} checked={!!row.spec.photo} onCheckedChange={on => { const { photo: _ph, ...rest } = row.spec; update(i, row.item, on ? { ...rest, photo: true } : rest); }} /></label>
      </div>
      <div className="flex items-center justify-end gap-1">{row.spec.control === "choice" && <Input className="mr-auto min-w-0 flex-1" aria-label={`Choices for step ${i + 1}`} placeholder="Done, Satisfactory, N/A" value={(row.spec.options ?? DEFAULT_CHOICES).join(", ")} onChange={e => update(i, row.item, { ...row.spec, options: e.target.value.split(",").map(o => o.trimStart()) })} />}{row.spec.control === "reading" && <div className="mr-auto w-40"><UnitSelect label={`Unit for step ${i + 1}`} maxLength={20} value={row.spec.unit ?? ""} onChange={unit => update(i, row.item, { ...row.spec, unit })} /></div>}
        <Button type="button" size="icon" variant="ghost" title="Move up" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => setRows(moveChecklistRow(rows, i, i - 1))}><ArrowUp className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" title="Move down" aria-label={`Move step ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => setRows(moveChecklistRow(rows, i, i + 1))}><ArrowDown className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" title="Remove step" aria-label={`Remove step ${i + 1}`} onClick={() => setRows(rows.filter((_, index) => index !== i))}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>)}
    <Button type="button" size="sm" variant="outline" onClick={() => setRows([...rows, { item: "", spec: { ...DEFAULT_SPEC } }])}><Plus className="mr-1 h-4 w-4" />Add checklist step</Button>
  </div>;
}
