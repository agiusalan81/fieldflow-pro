import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDocumentNumber, NUMBERED_DOCUMENTS, type NumberFormat, type NumberingKind } from "@/lib/numbering";

type Config = Partial<Record<NumberingKind, NumberFormat>>;

/** Company Settings → Numbering: custom prefix, digits and start number per document. */
export function NumberingSettings({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["numbering", companyId], queryFn: async () => {
    const [s, c] = await Promise.all([
      supabase.from("company_settings").select("numbering").eq("company_id", companyId).single(),
      supabase.from("company_number_counters").select("kind,next_value"),
    ]);
    if (s.error) throw s.error;
    const cfg = (s.data.numbering ?? {}) as Config;
    for (const r of c.data ?? []) { const k = r.kind as NumberingKind; if (cfg[k]) cfg[k] = { ...cfg[k]!, next: Number(r.next_value) }; }
    return cfg;
  } });
  const [draft, setDraft] = useState<Config | null>(null); const [busy, setBusy] = useState(false);
  const v = draft ?? q.data; if (!v) return <p>{q.error?.message ?? "Loading…"}</p>;
  const save = async () => {
    setBusy(true);
    const r = await supabase.rpc("save_document_numbering", { _config: v as unknown as Json });
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return; }
    setDraft(null); await qc.invalidateQueries({ queryKey: ["numbering", companyId] }); toast.success("Numbering saved");
  };
  return <section className="space-y-4">
    <div><h2 className="font-medium">Document numbering</h2><p className="text-sm text-muted-foreground">Continue from your previous software: set a prefix, number of digits and the next number to use. Leave a document unticked to keep automatic numbering.</p></div>
    {NUMBERED_DOCUMENTS.map(d => { const f = v[d.key]; const set = (n: Partial<NumberFormat> | null) => setDraft({ ...v, [d.key]: n === null ? undefined : { prefix: d.prefix, padding: 4, next: 1, ...f, ...n } });
      return <div key={d.key} className="space-y-3 border-b pb-4">
        <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={!!f} onCheckedChange={c => set(c ? {} : null)} />{d.label}</label>
        {d.note && <p className="text-xs text-muted-foreground">{d.note}</p>}
        {f && <div className="grid gap-3 sm:grid-cols-4">
          <div><Label htmlFor={`num-${d.key}-prefix`}>Prefix</Label><Input id={`num-${d.key}-prefix`} maxLength={12} value={f.prefix} onChange={e => set({ prefix: e.target.value.replace(/[^A-Za-z0-9/_.#-]/g, "") })} /></div>
          <div><Label htmlFor={`num-${d.key}-pad`}>Digits</Label><Input id={`num-${d.key}-pad`} type="number" min={1} max={10} value={f.padding} onChange={e => set({ padding: Number(e.target.value) })} /></div>
          <div><Label htmlFor={`num-${d.key}-next`}>Next number</Label><Input id={`num-${d.key}-next`} type="number" min={1} value={f.next} onChange={e => set({ next: Number(e.target.value) })} /></div>
          <div><Label>Example</Label><p className="flex h-10 items-center font-mono text-sm">{formatDocumentNumber(f)}</p></div>
        </div>}
      </div>; })}
    <Button disabled={busy || !draft} onClick={() => void save()}>{busy ? "Saving…" : "Save numbering"}</Button>
  </section>;
}
