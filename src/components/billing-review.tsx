import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyRules } from "@/lib/company";
import { splitHours, addSplits, DEFAULT_RULES, technicianCount } from "@/lib/jobsheets";
import { draftLines, lineTotal, linesTotal, parseRates, pickSource, ZERO_RATES, ratesFor, returnFeeLine, type Line, type PriceSource } from "@/lib/billing";
import { parseIntegrations, ACCOUNTING } from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SOURCES: Record<PriceSource, string> = { estimate: "Fixed estimate", contract: "Maintenance contract", client: "Client rate card", company: "Company default rates" };

export function BillingReview({ sheetId, onClose }: { sheetId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: c } = useCompanyRules();
  const rules = c?.rules ?? DEFAULT_RULES;
  const { data } = useQuery({
    queryKey: ["billing-review", sheetId],
    enabled: !!sheetId,
    queryFn: async () => {
      if (!sheetId) throw new Error("Select a job sheet");
      const { data: s, error } = await supabase.from("job_sheets").select("id, jobsheet_number, client_id, site_id, estimate_id, billing_status, billing_source, billing_data, created_at, clients(name, labor_rates), return_fee_hours, jobsheet_time_logs(log_date, time_in, time_out, traveling_time_hours, technician_initials, technician_count), jobsheet_parts(part_description, quantity, unit)").eq("id", sheetId).single();
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const [est, ag, cs] = await Promise.all([
        supabase.from("lift_estimates").select("id, title, client_price, quoted_amount, fixed_labor, status").eq("client_id", s.client_id).in("status", ["client_ready", "won"]),
        supabase.from("maintenance_agreements").select("id, contract_types(name, labour_discount_pct, parts_discount_pct)").eq("client_id", s.client_id).lte("start_date", today).gte("end_date", today).limit(1),
        supabase.from("company_settings").select("default_rates, integrations").maybeSingle(),
      ]);
      return { s, estimates: est.data ?? [], agreement: ag.data?.[0] ?? null, company: parseRates(cs.data?.default_rates) ?? ZERO_RATES, integ: parseIntegrations(cs.data?.integrations) };
    },
  });
  const [estimateId, setEstimateId] = useState<string>("none");
  const [source, setSource] = useState<PriceSource>("company");
  const [lines, setLines] = useState<Line[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(false); }, [sheetId]);

  const hours = (data?.s.jobsheet_time_logs ?? []).reduce((a, l) => {
    const h = splitHours(l.log_date, l.time_in, l.time_out, rules);
    const n = technicianCount(l.technician_count, l.technician_initials);
    const t = Number(l.traveling_time_hours) || 0;
    return addSplits(a, { standard: +((h.standard + t) * n).toFixed(2), ot15: h.ot15 * n, ot20: h.ot20 * n });
  }, { standard: 0, ot15: 0, ot20: 0 });
  const clientRates = parseRates(data?.s.clients?.labor_rates);
  const discount = Number(data?.agreement?.contract_types?.labour_discount_pct ?? 0);

  const build = (src: PriceSource, estId: string) => {
    if (!data) return [];
    const e = data.estimates.find((x) => x.id === estId);
    const base = draftLines({ source: src, hours, company: data.company, client: clientRates, contractDiscountPct: discount, estimate: e ? { title: e.title, price: Number(e.client_price ?? e.quoted_amount ?? 0), fixedLabor: e.fixed_labor } : null });
    const parts: Line[] = src === "estimate" ? [] : data.s.jobsheet_parts.map((p) => ({ description: p.part_description, qty: Number(p.quantity), unit_price: 0, kind: "parts" }));
    const fee = returnFeeLine(Number(data.s.return_fee_hours ?? 0), ratesFor(src === "estimate" ? "company" : src, data.company, clientRates));
    return [...base, ...(fee ? [fee] : []), ...parts];
  };

  useEffect(() => {
    if (!data || ready) return;
    const saved = data.s.billing_data as { lines?: Line[] } | null;
    const est = data.s.estimate_id ?? "none";
    const src = (data.s.billing_source as PriceSource) ?? pickSource({ estimate: est !== "none", contract: !!data.agreement, clientRates: !!clientRates });
    setEstimateId(est); setSource(src);
    setLines(saved?.lines?.length ? saved.lines : build(src, est));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready]);

  const change = (src: PriceSource, est = estimateId) => { setSource(src); setEstimateId(est); setLines(build(src, est)); };
  const setLine = (i: number, p: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const persist = async (status: "approved" | "exported") => {
    if (!data) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("job_sheets").update({
      estimate_id: estimateId === "none" ? null : estimateId, billing_source: source, billing_status: status,
      billing_data: { lines, total: linesTotal(lines), hours } as never, billing_reviewed_by: u.user?.id ?? null, billing_reviewed_at: new Date().toISOString(),
    }).eq("id", data.s.id);
    if (error) { toast.error(error.message); return; }
    const prov = ACCOUNTING.find((a) => a.key === data.integ.accounting.provider)?.label;
    toast.success(status === "approved" ? "Billing approved" : prov ? `Marked as sent to ${prov} (connection not live yet)` : "Marked as invoiced");
    qc.invalidateQueries({ queryKey: ["overview"] }); qc.invalidateQueries({ queryKey: ["billing-review", sheetId] });
    onClose();
  };

  return (
    <Dialog open={!!sheetId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Billing review · Job sheet- {data?.s.jobsheet_number}</DialogTitle></DialogHeader>
        {!data ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{data.s.clients?.name} · status: <span className="font-medium text-foreground">{data.s.billing_status}</span></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Price from</Label>
                <Select value={source} onValueChange={(v) => change(v as PriceSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SOURCES) as PriceSource[]).map((k) => (
                      <SelectItem key={k} value={k} disabled={(k === "estimate" && !data.estimates.length) || (k === "contract" && !data.agreement) || (k === "client" && !clientRates)}>{SOURCES[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {source === "estimate" && (
                <div className="space-y-1.5"><Label>Estimate</Label>
                  <Select value={estimateId} onValueChange={(v) => change("estimate", v)}>
                    <SelectTrigger><SelectValue placeholder="Choose estimate" /></SelectTrigger>
                    <SelectContent>{data.estimates.map((e) => <SelectItem key={e.id} value={e.id}>{e.title} · €{Number(e.client_price ?? e.quoted_amount ?? 0).toFixed(2)}{e.fixed_labor ? " (labour included)" : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {source === "contract" && <p className="self-end text-sm text-muted-foreground">{data.agreement?.contract_types?.name} · {discount}% labour discount</p>}
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Actual labour from job sheet (on-site time × technicians)</p>
              <p className="tabular-nums text-foreground">{hours.standard} h std · {hours.ot15} h 1.5× · {hours.ot20} h 2×</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 font-medium">Item</th><th className="w-20 py-2 font-medium">Qty</th><th className="w-28 py-2 font-medium">Unit price</th><th className="w-24 py-2 text-right font-medium">Total</th><th className="w-8" /></tr></thead>
                <tbody className="divide-y">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2"><Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                      <td className="py-1.5 pr-2"><Input type="number" step="0.25" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) || 0 })} /></td>
                      <td className="py-1.5 pr-2"><Input type="number" step="0.01" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) || 0 })} /></td>
                      <td className="py-1.5 text-right tabular-nums">{lineTotal(l).toFixed(2)}</td>
                      <td><Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" onClick={() => setLines([...lines, { description: "Extra work / parts", qty: 1, unit_price: 0, kind: "extra" }])}><Plus className="mr-1 h-4 w-4" />Add line</Button>
              <p className="font-display text-xl tabular-nums text-foreground">€{linesTotal(lines).toFixed(2)} <span className="text-xs text-muted-foreground">excl. tax</span></p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => persist("approved")}>Approve</Button>
              <Button onClick={() => persist("exported")}>Approve & send to accounting</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
