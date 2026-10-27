import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BookmarkPlus, FileOutput, Plus, Trash2 } from "lucide-react";
import { EquipmentAndLayout, ProposalContent, ProposalPreview, TechnicalSpecs } from "@/components/lift-costing-proposal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useProfile } from "@/lib/profile";
import { EmptyState } from "@/components/app-shell";
import { NumInput } from "@/components/num-input";
import { quoteAction } from "@/components/customer-quotes";
import { emptyQuoteDocument, newQuoteLine } from "@/lib/customer-quotes";
import {
  STAGE_PRESETS,
  comparisonMatrix,
  costBreakdown,
  emptyCosting,
  normalizeCosting,
  priceWith,
  reconcileClientLines,
  stageAmounts,
  applyTemplate,
  normalizeTemplate,
  proposalSummary,
  specRows,
  templateFromDraft,
  equipmentLabel,
  type CostingDraft,
} from "@/lib/lift-costing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const euro = (n: number) => `€${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function LiftCosting() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<CostingDraft | null>(null);

  const { data = [], isPending } = useQuery({
    queryKey: ["lift-costing"],
    queryFn: async () => {
      const r = await supabase.from("lift_costing_sheets").select("*").order("updated_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button className="h-11 w-full sm:w-auto" onClick={() => setDraft(emptyCosting())}><Plus className="mr-1 h-4 w-4" />New costing sheet</Button>
      {isPending ? <p>Loading costing sheets…</p> : !data.length ? (
        <EmptyState>No costing sheets yet. Cost a supplier offer here, compare margins, then push a clean quote to the client.</EmptyState>
      ) : data.map((c) => (
        <article key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{c.title || "Costing sheet"}</p>
            <p className="text-sm text-muted-foreground">
              Cost {euro(Number(c.total_cost))} · Client {euro(Number(c.client_price))} · {c.status === "pushed_to_quote" ? "Quote created" : c.status}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDraft(normalizeCosting(c))}>Open</Button>
        </article>
      ))}
      {draft && profile && (
        <CostingEditor draft={draft} setDraft={setDraft} companyId={profile.company_id} onSaved={() => { setDraft(null); qc.invalidateQueries({ queryKey: ["lift-costing"] }); }} />
      )}
    </div>
  );
}

function CostingEditor({ draft, setDraft, companyId, onSaved }: { draft: CostingDraft; setDraft: (d: CostingDraft | null) => void; companyId: string; onSaved: () => void }) {
  const navigate = useNavigate();
  const d = draft;
  const set = (p: Partial<CostingDraft>) => setDraft({ ...d, ...p });

  const { data: surveys = [] } = useQuery({
    queryKey: ["lift-surveys-min"],
    queryFn: async () => (await supabase.from("lift_surveys").select("id, survey_number, purpose, client_id, site_id, requires_dismantling, clients(name), sites(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: rfqs = [] } = useQuery({
    queryKey: ["estimates"],
    queryFn: async () => (await supabase.from("lift_estimates").select("id, title, client_id, site_id, quoted_amount").order("updated_at", { ascending: false })).data ?? [],
  });

  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ["lift-costing-templates"],
    queryFn: async () => (await supabase.from("lift_costing_templates").select("*").order("name")).data?.map((t) => normalizeTemplate(t)) ?? [],
  });
  const saveAsTemplate = async () => {
    const name = window.prompt("Template name (e.g. 4-post lift, China goods lift, Dumbwaiter)", d.title || equipmentLabel(d.equipment_type));
    if (!name?.trim()) return;
    const t = templateFromDraft(d, name.trim());
    const r = await supabase.from("lift_costing_templates").insert({ ...t, defaults: t.defaults as unknown as Json, options: t.options as unknown as Json, inclusions: t.inclusions as unknown as Json, exclusions: t.exclusions as unknown as Json, custom_specs: t.custom_specs as unknown as Json, company_id: companyId }).select("id").single();
    if (r.error) { toast.error(r.error.message); return; }
    set({ template_id: r.data.id });
    await refetchTemplates();
    toast.success(`Template "${name.trim()}" saved — pick it next time to prefill everything`);
  };
  const deleteTemplate = async () => {
    const t = templates.find((x) => x.id === d.template_id);
    if (!t || !window.confirm(`Delete template "${t.name}"? Existing sheets keep their content.`)) return;
    const r = await supabase.from("lift_costing_templates").delete().eq("id", t.id);
    if (r.error) { toast.error(r.error.message); return; }
    set({ template_id: null }); await refetchTemplates(); toast.success("Template deleted");
  };
  const summary = useMemo(() => proposalSummary(d), [d]);

  const survey = surveys.find((s) => s.id === d.survey_id);
  const rfq = rfqs.find((r) => r.id === d.rfq_id);

  const loadWages = async () => {
    const r = await supabase.from("employee_payroll_settings").select("hourly_rate");
    const rates = (r.data ?? []).map((x) => Number(x.hourly_rate)).filter((n) => n > 0);
    if (!rates.length) { toast.error("No employee hourly rates set up in Payroll yet"); return; }
    const avg = Math.round((rates.reduce((s, n) => s + n, 0) / rates.length) * 100) / 100;
    set({ mechanical_rate: avg, electrical_rate: avg });
    toast.success(`Loaded company average rate ${euro(avg)}/h — adjust per role as needed`);
  };

  const breakdown = useMemo(() => costBreakdown(d), [d]);
  const matrix = useMemo(() => comparisonMatrix(d), [d]);
  const current = useMemo(() => priceWith(d, d.equipment_markup_pct, d.labour_markup_pct, d.subcontractor_markup_pct), [d]);
  const lines = useMemo(() => reconcileClientLines(d), [d]);
  const stages = useMemo(() => stageAmounts(current.price, d.stages), [current.price, d.stages]);

  const save = useMutation({
    mutationFn: async (status?: string) => {
      const row = {
        title: d.title.trim() || survey?.survey_number || rfq?.title || "Costing sheet",
        survey_id: d.survey_id, rfq_id: d.rfq_id, quote_id: d.quote_id,
        equipment_cost: d.equipment_cost, freight_cost: d.freight_cost, customs_cost: d.customs_cost,
        dismantling_cost: d.dismantling_cost, third_party_costs: d.third_party as unknown as Json,
        mechanical_hours: d.mechanical_hours, mechanical_rate: d.mechanical_rate,
        electrical_hours: d.electrical_hours, electrical_rate: d.electrical_rate,
        certification_cost: d.certification_cost,
        equipment_markup_pct: d.equipment_markup_pct, labour_markup_pct: d.labour_markup_pct,
        subcontractor_markup_pct: d.subcontractor_markup_pct, contingency_pct: d.contingency_pct,
        comparison_scenarios: matrix as unknown as Json,
        stage_payments: d.stages as unknown as Json,
        total_cost: breakdown.total, client_price: current.price,
        template_id: d.template_id, equipment_type: d.equipment_type, output_style: d.output_style,
        turnkey_description: d.turnkey_description, spec_groups: d.spec_groups, specs: d.specs as unknown as Json,
        custom_specs: d.custom_specs as unknown as Json, inclusions: d.inclusions as unknown as Json,
        exclusions: d.exclusions as unknown as Json, options: d.options as unknown as Json,
        photos: d.photos as unknown as Json, notes: d.notes, vat_pct: d.vat_pct,
        status: status ?? (d.status === "draft" ? "priced" : d.status),
        updated_at: new Date().toISOString(),
      };
      const r = d.isNew
        ? await supabase.from("lift_costing_sheets").insert({ ...row, id: d.id, company_id: companyId })
        : await supabase.from("lift_costing_sheets").update(row).eq("id", d.id);
      if (r.error) throw r.error;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save costing sheet"),
  });

  const pushToQuote = async () => {
    const clientId = survey?.client_id ?? rfq?.client_id ?? null;
    const siteId = survey?.site_id ?? rfq?.site_id ?? null;
    if (!clientId) { toast.error("Link a survey or RFQ with a client first"); return; }
    if (!summary.lines.length) { toast.error("Enter costs first — there is nothing to quote"); return; }
    const specText = specRows(d).map((x) => `${x.label}: ${x.value}`).join("\n");
    const incl = d.inclusions.filter((x) => x.trim()).map((x) => `• ${x}`).join("\n");
    const avail = d.options.filter((o) => !o.selected && o.label.trim()).map((o) => `• ${o.label} — €${o.amount.toFixed(2)} + VAT`).join("\n");
    const doc = {
      ...emptyQuoteDocument("quote"),
      title: d.title.trim() || survey?.survey_number || rfq?.title || "Lift installation",
      lines: summary.lines.map((l) => ({ ...newQuoteLine(d.vat_pct), description: l.description, rate: l.amount })),
      scope: [specText && `Technical specification\n${specText}`, incl && `Included\n${incl}`].filter(Boolean).join("\n\n"),
      exclusions: d.exclusions.filter((x) => x.trim()).map((x) => `• ${x}`).join("\n"),
      notes: [d.notes.trim(), avail && `Available options\n${avail}`].filter(Boolean).join("\n\n"),
      photos: d.photos,
      payment: d.stages.length ? stageAmounts(summary.grandNet, d.stages).map((s) => `${s.label}: ${s.pct}% (${euro(s.amount)})`).join("\n") : "",
    };
    const quoteId = crypto.randomUUID();
    try {
      await quoteAction(quoteId, "save", { id: quoteId, client_id: clientId, site_id: siteId, asset_id: null, source_sheet_id: null, private_notes: `From costing sheet ${d.title || d.id}`, data: doc });
      await save.mutateAsync("pushed_to_quote");
      await supabase.from("lift_costing_sheets").update({ quote_id: quoteId, status: "pushed_to_quote", updated_at: new Date().toISOString() }).eq("id", d.id);
      toast.success("Customer quote created — review and issue it from Estimates");
      void navigate({ to: "/estimates" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the quote");
    }
  };

  const money = (label: string, key: "equipment_cost" | "freight_cost" | "customs_cost" | "dismantling_cost" | "certification_cost") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <NumInput className="h-10" min={0} step="0.01" value={d[key]} onChange={(v) => set({ [key]: v } as Partial<CostingDraft>)} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && setDraft(null)}>
      <DialogContent className="max-h-[94dvh] max-w-7xl overflow-y-auto">
        <DialogHeader><DialogTitle>{d.isNew ? "New costing sheet" : "Edit costing sheet"}</DialogTitle></DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Template</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={d.template_id ?? "none"} onValueChange={(v) => { const t = templates.find((x) => x.id === v); setDraft(t ? applyTemplate(d, t) : { ...d, template_id: null }); }}>
                <SelectTrigger className="h-10 w-full sm:w-72"><SelectValue placeholder="No template" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No template</SelectItem>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {equipmentLabel(t.equipment_type)}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" onClick={saveAsTemplate}><BookmarkPlus className="mr-1 h-4 w-4" />Save setup as new template</Button>
              {d.template_id && <Button type="button" size="sm" variant="ghost" onClick={deleteTemplate}><Trash2 className="mr-1 h-4 w-4" />Delete template</Button>}
            </div>
            <p className="text-xs text-muted-foreground">Templates hold equipment type, spec fields, markups, labour hours, VAT, stages, inclusions, exclusions, options, notes and the client price layout. Everything stays editable on each sheet.</p>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Title</Label><Input className="h-10" placeholder="e.g. 8-person MRL, 5 stops" value={d.title} onChange={(e) => set({ title: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Linked site survey</Label>
              <Select value={d.survey_id ?? "none"} onValueChange={(v) => set({ survey_id: v === "none" ? null : v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{surveys.map((s) => <SelectItem key={s.id} value={s.id}>{s.survey_number} · {s.sites?.name ?? s.clients?.name ?? "No client"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Linked supplier RFQ</Label>
              <Select value={d.rfq_id ?? "none"} onValueChange={(v) => { const r = rfqs.find((x) => x.id === v); set({ rfq_id: v === "none" ? null : v, ...(r?.quoted_amount && !d.equipment_cost ? { equipment_cost: Number(r.quoted_amount) } : {}) }); }}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{rfqs.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}{r.quoted_amount ? ` · €${Number(r.quoted_amount).toLocaleString()}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <EquipmentAndLayout d={d} set={set} />
          <TechnicalSpecs d={d} set={set} />
          {survey?.requires_dismantling && !d.dismantling_cost && <p className="text-xs text-accent-foreground">The linked survey requires dismantling — remember to cost it below.</p>}

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Equipment & freight</legend>
            <div className="grid gap-3 sm:grid-cols-3">{money("Equipment package (€)", "equipment_cost")}{money("Freight (€)", "freight_cost")}{money("Customs & duties (€)", "customs_cost")}</div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Installation & commissioning labour</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label className="text-xs">Mechanical hours</Label><NumInput className="h-10" min={0} step="1" value={d.mechanical_hours} onChange={(v) => set({ mechanical_hours: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Mechanical rate (€/h)</Label><NumInput className="h-10" min={0} step="0.01" value={d.mechanical_rate} onChange={(v) => set({ mechanical_rate: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Electrical hours</Label><NumInput className="h-10" min={0} step="1" value={d.electrical_hours} onChange={(v) => set({ electrical_hours: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Electrical rate (€/h)</Label><NumInput className="h-10" min={0} step="0.01" value={d.electrical_rate} onChange={(v) => set({ electrical_rate: v })} /></div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={loadWages}>Load company wage average from Payroll</Button>
            <p className="text-xs text-muted-foreground">Labour cost: {euro(breakdown.labour)}</p>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Third-party site works & services</legend>
            {d.third_party.map((t, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1"><Label className="text-xs">Description</Label><Input className="h-10" value={t.label} onChange={(e) => set({ third_party: d.third_party.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)) })} /></div>
                <div className="w-32 space-y-1"><Label className="text-xs">Amount (€)</Label><NumInput className="h-10" min={0} step="0.01" value={t.amount} onChange={(v) => set({ third_party: d.third_party.map((x, xi) => (xi === i ? { ...x, amount: v } : x)) })} /></div>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove cost" onClick={() => set({ third_party: d.third_party.filter((_, xi) => xi !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => set({ third_party: [...d.third_party, { label: "", amount: 0 }] })}><Plus className="mr-1 h-4 w-4" />Add cost (crane, permits, scaffolding…)</Button>
            <div className="grid gap-3 sm:grid-cols-2">{money("Dismantling & disposal (€)", "dismantling_cost")}{money("Statutory inspection & certification (€)", "certification_cost")}</div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Markups & margin comparison</legend>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1"><Label className="text-xs">Equipment markup %</Label><NumInput className="h-10" min={0} step="0.5" value={d.equipment_markup_pct} onChange={(v) => set({ equipment_markup_pct: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Labour markup %</Label><NumInput className="h-10" min={0} step="0.5" value={d.labour_markup_pct} onChange={(v) => set({ labour_markup_pct: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Subcontractor markup %</Label><NumInput className="h-10" min={0} step="0.5" value={d.subcontractor_markup_pct} onChange={(v) => set({ subcontractor_markup_pct: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Warranty contingency %</Label><NumInput className="h-10" min={0} step="0.5" value={d.contingency_pct} onChange={(v) => set({ contingency_pct: v })} /></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Scenario</th><th className="p-2">Markups (eq/lab/sub)</th><th className="p-2 text-right">Client price</th><th className="p-2 text-right">Gross profit</th><th className="p-2 text-right">Margin</th><th className="p-2" /></tr></thead>
                <tbody>
                  {matrix.map((m) => (
                    <tr key={m.key} className="border-b last:border-0">
                      <td className="p-2 font-medium">{m.label}</td>
                      <td className="p-2 text-muted-foreground">{m.equipment_markup_pct}/{m.labour_markup_pct}/{m.subcontractor_markup_pct}%</td>
                      <td className="p-2 text-right">{euro(m.price)}</td>
                      <td className="p-2 text-right">{euro(m.profit)}</td>
                      <td className="p-2 text-right">{m.margin_pct}%</td>
                      <td className="p-2 text-right">{m.key !== "current" && <Button type="button" size="sm" variant="outline" onClick={() => set({ equipment_markup_pct: m.equipment_markup_pct, labour_markup_pct: m.labour_markup_pct, subcontractor_markup_pct: m.subcontractor_markup_pct })}>Apply</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm">Total cost {euro(breakdown.total)} → client price <strong>{euro(current.price)}</strong> · profit {euro(current.profit)} ({current.margin_pct}%)</p>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Stage payments</legend>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => set({ stages: STAGE_PRESETS["new_installation"]! })}>New installation 30/40/20/10</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => set({ stages: STAGE_PRESETS["modernisation"]! })}>Modernisation 40/40/20</Button>
            </div>
            {stages.map((s, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1"><Label className="text-xs">Stage</Label><Input className="h-10" value={s.label} onChange={(e) => set({ stages: d.stages.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)) })} /></div>
                <div className="w-24 space-y-1"><Label className="text-xs">%</Label><NumInput className="h-10" min={0} max={100} step="1" value={s.pct} onChange={(v) => set({ stages: d.stages.map((x, xi) => (xi === i ? { ...x, pct: v } : x)) })} /></div>
                <span className="w-28 pb-2 text-right text-sm text-muted-foreground">{euro(s.amount)}</span>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove stage" onClick={() => set({ stages: d.stages.filter((_, xi) => xi !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {d.stages.length > 0 && <p className={`text-xs ${d.stages.reduce((s, x) => s + x.pct, 0) === 100 ? "text-muted-foreground" : "text-destructive"}`}>Total: {d.stages.reduce((s, x) => s + x.pct, 0)}%{d.stages.reduce((s, x) => s + x.pct, 0) !== 100 ? " — should equal 100%" : ""}</p>}
            <Button type="button" size="sm" variant="outline" onClick={() => set({ stages: [...d.stages, { label: "", pct: 0 }] })}><Plus className="mr-1 h-4 w-4" />Add stage</Button>
          </fieldset>

          <ProposalContent d={d} set={set} />

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button className="h-11" disabled={save.isPending} onClick={async () => { await save.mutateAsync(undefined); toast.success("Costing sheet saved"); onSaved(); }}>{save.isPending ? "Saving…" : "Save costing sheet"}</Button>
            <Button className="h-11" variant="secondary" disabled={save.isPending || !summary.lines.length} onClick={pushToQuote}><FileOutput className="mr-1 h-4 w-4" />Push to customer quote</Button>
            <Button className="h-11" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-sm font-medium">Client proposal preview <span className="text-xs font-normal text-muted-foreground">(costs, suppliers & margins hidden)</span></p>
          <ProposalPreview d={d} />
        </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
