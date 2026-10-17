import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BLOCKS, DOC_TYPES, moveBlock, parsePresets, parseTemplate, parseTerms, visibleBlocks, type NotePreset, type PdfTemplate, type Terms } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const label = (k: string) => BLOCKS.find((b) => b.key === k)?.label ?? k;

export function DocumentSettings({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["doc-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("pdf_template, terms, note_presets").maybeSingle()).data,
  });
  const [t, setT] = useState<PdfTemplate | null>(null);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [presets, setPresets] = useState<NotePreset[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    if (data !== undefined && !t) { setT(parseTemplate(data?.pdf_template)); setTerms(parseTerms(data?.terms)); setPresets(parsePresets(data?.note_presets)); }
  }, [data, t]);
  if (!t || !terms) return null;

  const save = async () => {
    const { error } = await supabase.from("company_settings").upsert({ company_id: companyId, pdf_template: t as never, terms: terms as never, note_presets: presets.filter((p) => p.label.trim()) as never });
    if (error) { toast.error(error.message); return; }
    toast.success("Document templates saved");
    qc.invalidateQueries({ queryKey: ["doc-settings"] });
    qc.invalidateQueries({ queryKey: ["note-presets"] });
  };
  const toggle = (k: PdfTemplate["order"][number]) => setT({ ...t, hidden: t.hidden.includes(k) ? t.hidden.filter((x) => x !== k) : [...t.hidden, k] });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div><h2 className="font-medium text-foreground">Job sheet PDF layout</h2><p className="text-sm text-muted-foreground">Drag sections to reorder. Switch off anything you don't want clients to see.</p></div>
          <div className="space-y-1.5"><Label>Header text</Label><Input placeholder="e.g. Licensed lift contractor · VAT MT1234" value={t.header} onChange={(e) => setT({ ...t, header: e.target.value })} /></div>
          <ul className="space-y-1.5">
            {t.order.map((k, i) => (
              <li key={k} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) setT({ ...t, order: moveBlock(t.order, drag, i) }); setDrag(null); }}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${t.hidden.includes(k) ? "opacity-50" : ""}`}>
                <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                <span className="flex-1">{label(k)}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up" onClick={() => setT({ ...t, order: moveBlock(t.order, i, i - 1) })}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down" onClick={() => setT({ ...t, order: moveBlock(t.order, i, i + 1) })}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Switch aria-label={`Show ${label(k)}`} checked={!t.hidden.includes(k)} onCheckedChange={() => toggle(k)} />
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-sm"><Switch checked={t.showTravel} onCheckedChange={(c) => setT({ ...t, showTravel: c })} />Show travel hours in the time sheet</label>
          <div className="space-y-1.5"><Label>Footer text</Label><Input placeholder="e.g. Thank you for choosing us" value={t.footer} onChange={(e) => setT({ ...t, footer: e.target.value })} /></div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</p>
          <div className="space-y-2 rounded-lg border bg-background p-4 text-xs">
            {t.header && <p className="text-muted-foreground">{t.header}</p>}
            <p className="text-base font-semibold text-foreground">Your company · Job sheet #1042</p>
            {visibleBlocks(t).map((k) => (
              <div key={k} className="rounded border border-dashed p-2">
                <p className="font-medium uppercase text-muted-foreground">{label(k)}</p>
                <div className="mt-1 h-2 w-3/4 rounded bg-muted" />
              </div>
            ))}
            {terms.job_sheet.enabled && <div className="rounded border border-dashed p-2"><p className="font-medium uppercase text-muted-foreground">Terms & conditions</p><p className="line-clamp-3 text-muted-foreground">{terms.job_sheet.text || "—"}</p></div>}
            {t.footer && <p className="text-center text-muted-foreground">{t.footer}</p>}
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Terms & conditions</h2><p className="text-sm text-muted-foreground">Printed at the end of the client PDF when switched on.</p></div>
        {DOC_TYPES.map((d) => (
          <div key={d.key} className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center justify-between text-sm font-medium">{d.label}<Switch checked={terms[d.key].enabled} onCheckedChange={(c) => setTerms({ ...terms, [d.key]: { ...terms[d.key], enabled: c } })} /></label>
            {terms[d.key].enabled && <Textarea rows={4} value={terms[d.key].text} onChange={(e) => setTerms({ ...terms, [d.key]: { ...terms[d.key], text: e.target.value } })} />}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Estimates and agreements will use these once their PDFs are generated.</p>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Special note presets</h2><p className="text-sm text-muted-foreground">Quick notes technicians can add to a job sheet before sending it.</p></div>
        {presets.map((p, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)_auto]">
            <Input placeholder="Button label" value={p.label} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <Input placeholder="Note text" value={p.text} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
            <Button size="icon" variant="ghost" aria-label="Remove preset" onClick={() => setPresets(presets.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setPresets([...presets, { label: "", text: "" }])}><Plus className="mr-1 h-4 w-4" />Add preset</Button>
      </section>

      <Button className="h-11" onClick={save}>Save document templates</Button>
    </div>
  );
}
