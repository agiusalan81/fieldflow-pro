import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TRADES, UNITS, missingStarter, type TradeKey } from "@/lib/price-list";
import { usePlanFeatures } from "@/lib/plan-features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/app-shell";

type Item = { id: string; trade: string; category: string; name: string; unit: string; installation_method: string | null; cost_price: number; unit_rate: number; vat_rate: number; is_tally: boolean };
const blank = { category: "", name: "", unit: "each", installation_method: "", cost_price: "", unit_rate: "", vat_rate: "18", is_tally: false };
const sel = "h-10 w-full rounded-md border bg-background px-3 text-foreground";

/** Company Settings → Price list (Pricing & QS module). */
export function PriceListSettings({ companyId }: { companyId: string }) {
  const on = usePlanFeatures();
  const qc = useQueryClient();
  const [trade, setTrade] = useState<TradeKey>("electrical");
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["price-list", companyId],
    queryFn: async () => {
      const r = await supabase.from("company_price_list_items").select("id, trade, category, name, unit, installation_method, cost_price, unit_rate, vat_rate, is_tally").is("archived_at", null).order("category").order("sort_order").order("name");
      if (r.error) throw r.error; return r.data as Item[];
    },
  });
  if (!on("qs_pricing")) return <EmptyState>Pricing & quantity surveying is not included in your plan. Contact your account manager to add it.</EmptyState>;
  const all = q.data ?? [];
  const items = all.filter((i) => i.trade === trade);
  const refresh = () => qc.invalidateQueries({ queryKey: ["price-list"] });
  const fail = (e: { message: string } | null) => { if (e) toast.error(e.message); return !!e; };

  const importStarter = async () => {
    const missing = missingStarter(trade, all);
    if (!missing.length) { toast.info("All starter items are already in your list"); return; }
    setBusy(true);
    const r = await supabase.from("company_price_list_items").insert(missing.map((m, i) => ({ company_id: companyId, trade: m.trade, category: m.category, name: m.name, unit: m.unit, is_tally: !!m.is_tally, sort_order: i })));
    setBusy(false);
    if (!fail(r.error)) { toast.success(`${missing.length} starter items added — enter your rates`); refresh(); }
  };
  const add = async () => {
    if (!draft.name.trim()) { toast.error("Enter an item name"); return; }
    setBusy(true);
    const r = await supabase.from("company_price_list_items").insert({ company_id: companyId, trade, category: draft.category.trim(), name: draft.name.trim(), unit: draft.unit, installation_method: draft.installation_method.trim() || null, cost_price: Number(draft.cost_price || 0), unit_rate: Number(draft.unit_rate || 0), vat_rate: Number(draft.vat_rate || 0), is_tally: draft.is_tally });
    setBusy(false);
    if (!fail(r.error)) { setDraft({ ...blank, category: draft.category }); refresh(); }
  };
  const update = async (id: string, patch: Partial<Item>) => { if (!fail((await supabase.from("company_price_list_items").update(patch).eq("id", id)).error)) refresh(); };
  const remove = async (id: string) => { if (!fail((await supabase.from("company_price_list_items").update({ archived_at: new Date().toISOString() }).eq("id", id)).error)) refresh(); };

  const groups = Array.from(new Set(items.map((i) => i.category)));
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Set your own items, installation methods and rates. Estimates and quantity surveys will use these prices.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 space-y-1"><Label htmlFor="pl-trade">Trade</Label><select id="pl-trade" className={sel} value={trade} onChange={(e) => setTrade(e.target.value as TradeKey)}>{TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
        {trade !== "custom" && <Button variant="outline" disabled={busy} onClick={importStarter}><Download className="mr-1 h-4 w-4" />Add starter items</Button>}
      </div>

      {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : items.length === 0 ? <EmptyState>No items yet for this trade. Add starter items or create your own below.</EmptyState> : groups.map((g) => (
        <section key={g} className="space-y-2">
          <h3 className="font-medium">{g || "Uncategorised"}</h3>
          <div className="hidden grid-cols-[minmax(0,2fr)_90px_minmax(0,1fr)_100px_100px_70px_60px_40px] gap-2 px-1 text-xs text-muted-foreground md:grid"><span>Item</span><span>Unit</span><span>Installation method</span><span>Cost</span><span>Rate</span><span>VAT %</span><span>Tally</span><span /></div>
          {items.filter((i) => i.category === g).map((i) => (
            <div key={i.id} className="grid grid-cols-2 gap-2 border-b pb-2 md:grid-cols-[minmax(0,2fr)_90px_minmax(0,1fr)_100px_100px_70px_60px_40px] md:items-center">
              <Input aria-label="Item name" className="col-span-2 md:col-span-1" defaultValue={i.name} onBlur={(e) => e.target.value.trim() && e.target.value !== i.name && update(i.id, { name: e.target.value.trim() })} />
              <select aria-label="Unit" className={sel} defaultValue={i.unit} onChange={(e) => update(i.id, { unit: e.target.value })}>{[...new Set([...UNITS, i.unit])].map((u) => <option key={u}>{u}</option>)}</select>
              <Input aria-label="Installation method" placeholder="e.g. Concealed" defaultValue={i.installation_method ?? ""} onBlur={(e) => e.target.value !== (i.installation_method ?? "") && update(i.id, { installation_method: e.target.value.trim() || null })} />
              <Input aria-label="Cost price" type="number" min={0} step="0.01" defaultValue={i.cost_price} onBlur={(e) => Number(e.target.value) !== Number(i.cost_price) && update(i.id, { cost_price: Number(e.target.value || 0) })} />
              <Input aria-label="Client rate" type="number" min={0} step="0.01" defaultValue={i.unit_rate} onBlur={(e) => Number(e.target.value) !== Number(i.unit_rate) && update(i.id, { unit_rate: Number(e.target.value || 0) })} />
              <Input aria-label="VAT %" type="number" min={0} max={100} step="0.01" defaultValue={i.vat_rate} onBlur={(e) => Number(e.target.value) !== Number(i.vat_rate) && update(i.id, { vat_rate: Number(e.target.value || 0) })} />
              <Switch aria-label="Count with tally on site" checked={i.is_tally} onCheckedChange={(v) => update(i.id, { is_tally: v })} />
              <Button size="icon" variant="ghost" aria-label={`Remove ${i.name}`} onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </section>
      ))}

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="font-medium">Add your own item</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label htmlFor="pl-cat">Category</Label><Input id="pl-cat" list="pl-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /><datalist id="pl-cats">{groups.map((g) => <option key={g} value={g} />)}</datalist></div>
          <div className="space-y-1 lg:col-span-2"><Label htmlFor="pl-name">Item</Label><Input id="pl-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="pl-unit">Unit</Label><select id="pl-unit" className={sel} value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="pl-method">Installation method</Label><Input id="pl-method" placeholder="e.g. Surface trunking" value={draft.installation_method} onChange={(e) => setDraft({ ...draft, installation_method: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="pl-cost">Cost price</Label><Input id="pl-cost" type="number" min={0} step="0.01" value={draft.cost_price} onChange={(e) => setDraft({ ...draft, cost_price: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="pl-rate">Client rate</Label><Input id="pl-rate" type="number" min={0} step="0.01" value={draft.unit_rate} onChange={(e) => setDraft({ ...draft, unit_rate: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="pl-vat">VAT %</Label><Input id="pl-vat" type="number" min={0} max={100} step="0.01" value={draft.vat_rate} onChange={(e) => setDraft({ ...draft, vat_rate: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.is_tally} onCheckedChange={(v) => setDraft({ ...draft, is_tally: v })} />Count with a tally on site (e.g. fittings, points)</label>
        <Button disabled={busy} onClick={add}><Plus className="mr-1 h-4 w-4" />Add item</Button>
      </section>
    </div>
  );
}
