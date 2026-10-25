import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { checklistRows, DEFAULT_SPEC, FIELD_CONTROLS, moveChecklistRow, type BlockAudience, type FieldControl, type FieldSpec } from "@/lib/document-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ChecklistRowEditor({ items, specs, onChange }: { items: string[]; specs: FieldSpec[]; onChange: (items: string[], specs: FieldSpec[]) => void }) {
  const rows = checklistRows(items, specs);
  const setRows = (next: typeof rows) => onChange(next.map(row => row.item), next.map(row => row.spec));
  const update = (index: number, item: string, spec: FieldSpec) => setRows(rows.map((row, i) => i === index ? { item, spec } : row));
  return <div className="space-y-2"><Label>Technician controls per step</Label>
    {rows.map((row, i) => <div key={i} className="space-y-2 rounded-lg border p-2">
      <div className="flex min-w-0 items-center gap-1"><span className="w-6 shrink-0 text-sm text-muted-foreground">{i + 1}.</span><Input aria-label={`Checklist step ${i + 1}`} placeholder="Step description" value={row.item} onChange={e => update(i, e.target.value, row.spec)} /></div>
      <div className="grid gap-2 sm:grid-cols-2"><Select value={row.spec.control} onValueChange={v => update(i, row.item, { ...row.spec, control: v as FieldControl })}><SelectTrigger aria-label={`Control for step ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent>{FIELD_CONTROLS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent></Select><Select value={row.spec.audience} onValueChange={v => update(i, row.item, { ...row.spec, audience: v as BlockAudience })}><SelectTrigger aria-label={`Visibility for step ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Both copies</SelectItem><SelectItem value="technician">Technician only</SelectItem><SelectItem value="client">Client only</SelectItem></SelectContent></Select></div>
      <div className="flex items-center justify-end gap-1">{row.spec.control === "reading" && <Input className="mr-auto max-w-40" aria-label={`Unit for step ${i + 1}`} placeholder="Unit (bar, °C)" maxLength={20} value={row.spec.unit} onChange={e => update(i, row.item, { ...row.spec, unit: e.target.value })} />}
        <Button type="button" size="icon" variant="ghost" title="Move up" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => setRows(moveChecklistRow(rows, i, i - 1))}><ArrowUp className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" title="Move down" aria-label={`Move step ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => setRows(moveChecklistRow(rows, i, i + 1))}><ArrowDown className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" title="Remove step" aria-label={`Remove step ${i + 1}`} onClick={() => setRows(rows.filter((_, index) => index !== i))}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>)}
    <Button type="button" size="sm" variant="outline" onClick={() => setRows([...rows, { item: "", spec: { ...DEFAULT_SPEC } }])}><Plus className="mr-1 h-4 w-4" />Add checklist step</Button>
  </div>;
}