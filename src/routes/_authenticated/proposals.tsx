import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, Plus, Trash2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useProfile, isManager } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { useCompanyRules } from "@/lib/company";
import { parseTemplate } from "@/lib/documents";
import { formatOfficeAddress, parseOfficeAddress } from "@/lib/contact-details";
import { TRADES, lineTotal } from "@/lib/price-list";
import { EQUIPMENT_TYPES, SCOPES, parseTerms, proposalTotals, visibleSections, type Line, type Spec, type Terms } from "@/lib/proposals";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/proposals")({ staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Proposals — FieldBridge" },
    { name: "description", content: "Build client proposals from your price list with equipment specifications and payment terms." },
    { property: "og:title", content: "Proposals — FieldBridge" },
    { property: "og:description", content: "Equipment specification and bill-of-quantities proposals as A4 PDFs." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ProposalsPage,
});

const sel = "h-10 w-full rounded-md border bg-background px-3 text-foreground";
type Row = { id: string; reference: string; title: string; trade: string; status: string; client_id: string | null; site_id: string | null; spec: Json; lines: Json; terms: Json; updated_at: string; clients: { name: string } | null };

function ProposalsPage() {
  const { data: profile } = useProfile();
  const on = usePlanFeatures();
  const [open, setOpen] = useState<string | null>(null);
  if (!profile) return <AppShell title="Proposals"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!isManager(profile) || !on("qs_pricing")) return <AppShell title="Proposals"><EmptyState>Proposals need the Pricing & quantity surveying module and supervisor or office access.</EmptyState></AppShell>;
  return <AppShell title="Proposals">{open ? <Editor id={open} onBack={() => setOpen(null)} /> : <List companyId={profile.company_id} onOpen={setOpen} />}</AppShell>;
}

function List({ companyId, onOpen }: { companyId: string; onOpen: (id: string) => void }) {
  const [trade, setTrade] = useState("elevator");
  const q = useQuery({ queryKey: ["proposals"], queryFn: async () => { const r = await supabase.from("proposals").select("id, reference, title, trade, status, updated_at, clients(name)").order("updated_at", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  const create = async () => {
    const r = await supabase.from("proposals").insert({ company_id: companyId, trade, title: trade === "elevator" ? "New lift proposal" : "New proposal", spec: { scope: SCOPES[0] } as Json, terms: parseTerms({}) as unknown as Json }).select("id").single();
    if (r.error) { toast.error(r.error.message); return; } onOpen(r.data.id);
  };
  return <div className="mx-auto max-w-5xl space-y-4">
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 space-y-1"><Label htmlFor="new-trade">Trade</Label><select id="new-trade" className={sel} value={trade} onChange={(e) => setTrade(e.target.value)}>{TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
      <Button onClick={create}><Plus className="mr-1 h-4 w-4" />New proposal</Button>
    </div>
    {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : !q.data?.length ? <EmptyState>No proposals yet.</EmptyState> :
      <ul className="space-y-2">{q.data.map((p) => <li key={p.id}><button className="w-full rounded-xl border bg-card p-4 text-left hover:bg-muted/40" onClick={() => onOpen(p.id)}>
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm text-primary">{p.reference}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{p.status}</span><span className="text-xs text-muted-foreground">{TRADES.find((t) => t.key === p.trade)?.label}</span></div>
        <p className="mt-1 font-medium">{p.title || "Untitled"}{p.clients?.name ? ` · ${p.clients.name}` : ""}</p>
        <p className="text-xs text-muted-foreground">Updated {new Date(p.updated_at).toLocaleString()}</p>
      </button></li>)}</ul>}
  </div>;
}

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return <div className="space-y-2"><Label>{label}</Label>
    {items.map((s, i) => <div key={i} className="flex gap-2"><Input aria-label={`${label} ${i + 1}`} value={s} onChange={(e) => onChange(items.map((x, j) => j === i ? e.target.value : x))} /><Button size="icon" variant="ghost" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}
    <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}><Plus className="mr-1 h-4 w-4" />Add</Button>
  </div>;
}

function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: company } = useCompanyRules();
  const currency = company?.locale.currency ?? "EUR";
  const q = useQuery({ queryKey: ["proposal", id], queryFn: async () => { const r = await supabase.from("proposals").select("*, clients(name)").eq("id", id).single(); if (r.error) throw r.error; return r.data as unknown as Row; } });
  const clients = useQuery({ queryKey: ["proposal-clients"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const sites = useQuery({ queryKey: ["proposal-sites"], queryFn: async () => (await supabase.from("sites").select("id, name, client_id").order("name")).data ?? [] });
  const prices = useQuery({ queryKey: ["price-list"], queryFn: async () => { const r = await supabase.from("company_price_list_items").select("id, trade, category, name, unit, installation_method, unit_rate, vat_rate").is("archived_at", null).order("category").order("name"); if (r.error) throw r.error; return r.data; } });
  const [p, setP] = useState<{ title: string; trade: string; status: string; client_id: string | null; site_id: string | null; spec: Spec; lines: Line[]; terms: Terms } | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data && !p) setP({ title: q.data.title, trade: q.data.trade, status: q.data.status, client_id: q.data.client_id, site_id: q.data.site_id, spec: (q.data.spec ?? {}) as Spec, lines: (Array.isArray(q.data.lines) ? q.data.lines : []) as unknown as Line[], terms: parseTerms(q.data.terms) }); }, [q.data, p]);
  if (!p || !q.data) return <p className="text-muted-foreground">{q.error?.message ?? "Loading…"}</p>;
  const set = (n: Partial<typeof p>) => setP({ ...p, ...n });
  const spec = (k: string, v: string) => set({ spec: { ...p.spec, [k]: v } });
  const terms = (n: Partial<Terms>) => set({ terms: { ...p.terms, ...n } });
  const line = (i: number, n: Partial<Line>) => set({ lines: p.lines.map((l, j) => j === i ? { ...l, ...n } : l) });
  const tradeItems = (prices.data ?? []).filter((x) => x.trade === p.trade);
  const totals = proposalTotals(p.lines, p.terms);
  const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency });
  const subtypes = EQUIPMENT_TYPES[p.spec.equipment_type ?? ""] ?? [];

  const save = async () => {
    setBusy(true);
    const r = await supabase.from("proposals").update({ title: p.title, status: p.status, client_id: p.client_id, site_id: p.site_id, spec: p.spec as Json, lines: p.lines as unknown as Json, terms: p.terms as unknown as Json }).eq("id", id);
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return false; }
    qc.invalidateQueries({ queryKey: ["proposals"] }); toast.success("Proposal saved"); return true;
  };
  const pdf = async () => {
    if (!(await save())) return;
    setBusy(true);
    try {
      const [s, c] = await Promise.all([supabase.from("company_settings").select("logo_data, pdf_template, office_address, company_address, vat_number").maybeSingle(), supabase.from("companies").select("name").maybeSingle()]);
      const t = parseTemplate(s.data?.pdf_template);
      const { buildProposalPdf } = await import("@/lib/proposal-pdf");
      const bytes = await buildProposalPdf({
        company: { name: c.data?.name ?? "", logo: s.data?.logo_data ?? "", address: formatOfficeAddress(parseOfficeAddress(s.data?.office_address, s.data?.company_address ?? "")).replace(/\n/g, ", "), vat: s.data?.vat_number ?? "", footer: t.footer, primary: t.primaryColor },
        reference: q.data!.reference, title: p.title, date: new Date().toLocaleDateString("en-GB"), currency,
        client: clients.data?.find((x) => x.id === p.client_id)?.name, site: sites.data?.find((x) => x.id === p.site_id)?.name,
        trade: p.trade, spec: p.spec, lines: p.lines, terms: p.terms,
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `${q.data!.reference}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create PDF"); } finally { setBusy(false); }
  };
  const remove = async () => { const r = await supabase.from("proposals").delete().eq("id", id); if (r.error) { toast.error(r.error.message); return; } qc.invalidateQueries({ queryKey: ["proposals"] }); onBack(); };

  return <div className="mx-auto max-w-5xl space-y-6 pb-24">
    <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />All proposals</Button><span className="font-mono text-sm text-primary">{q.data.reference}</span><span className="text-sm text-muted-foreground">{TRADES.find((t) => t.key === p.trade)?.label}</span></div>

    <section className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2"><Label htmlFor="pr-title">Title</Label><Input id="pr-title" value={p.title} onChange={(e) => set({ title: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="pr-client">Client</Label><select id="pr-client" className={sel} value={p.client_id ?? ""} onChange={(e) => set({ client_id: e.target.value || null, site_id: null })}><option value="">—</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="pr-site">Site</Label><select id="pr-site" className={sel} value={p.site_id ?? ""} onChange={(e) => set({ site_id: e.target.value || null })}><option value="">—</option>{sites.data?.filter((s) => !p.client_id || s.client_id === p.client_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="pr-scope">Work required</Label><Input id="pr-scope" list="pr-scopes" value={p.spec.scope ?? ""} onChange={(e) => spec("scope", e.target.value)} /><datalist id="pr-scopes">{SCOPES.map((s) => <option key={s} value={s} />)}</datalist></div>
      <div className="space-y-1"><Label htmlFor="pr-status">Status</Label><select id="pr-status" className={sel} value={p.status} onChange={(e) => set({ status: e.target.value })}>{["draft", "sent", "accepted", "declined"].map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}</select></div>
    </section>

    {p.trade === "elevator" && <section className="space-y-4">
      <h2 className="text-lg font-semibold">Equipment</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="pr-eq">Equipment type</Label><select id="pr-eq" className={sel} value={p.spec.equipment_type ?? ""} onChange={(e) => set({ spec: { ...p.spec, equipment_type: e.target.value, equipment_subtype: "" } })}><option value="">—</option>{Object.keys(EQUIPMENT_TYPES).map((k) => <option key={k}>{k}</option>)}</select></div>
        {subtypes.length > 0 && <div className="space-y-1"><Label htmlFor="pr-sub">Type</Label><select id="pr-sub" className={sel} value={p.spec.equipment_subtype ?? ""} onChange={(e) => spec("equipment_subtype", e.target.value)}><option value="">—</option>{subtypes.map((k) => <option key={k}>{k}</option>)}</select></div>}
        {(p.spec.equipment_type === "Other" || p.spec.equipment_subtype === "Other") && <div className="space-y-1"><Label htmlFor="pr-other">Describe equipment</Label><Input id="pr-other" value={p.spec.equipment_other ?? ""} onChange={(e) => spec("equipment_other", e.target.value)} /></div>}
      </div>
      {visibleSections(p.spec, p.trade).map((s) => <details key={s.key} className="rounded-lg border p-3" open={s.key === "technical"}>
        <summary className="cursor-pointer font-medium">{s.title}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{s.fields.map((fl) => <div key={fl.key} className={`space-y-1 ${fl.key.endsWith("_notes") ? "sm:col-span-2" : ""}`}><Label htmlFor={`sp-${fl.key}`}>{fl.label}</Label>
          {fl.options ? <select id={`sp-${fl.key}`} className={sel} value={p.spec[fl.key] ?? ""} onChange={(e) => spec(fl.key, e.target.value)}><option value="">—</option>{fl.options.map((o) => <option key={o}>{o}</option>)}</select>
          : fl.key.endsWith("_notes") ? <Textarea id={`sp-${fl.key}`} value={p.spec[fl.key] ?? ""} onChange={(e) => spec(fl.key, e.target.value)} />
          : <Input id={`sp-${fl.key}`} value={p.spec[fl.key] ?? ""} onChange={(e) => spec(fl.key, e.target.value)} />}</div>)}</div>
      </details>)}
    </section>}

    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{p.trade === "elevator" ? "Additional items & alternatives" : "Bill of quantities"}</h2>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Add from price list" className={`${sel} sm:max-w-md`} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add from price list…</option>{tradeItems.map((x) => <option key={x.id} value={x.id}>{x.category ? `${x.category} — ` : ""}{x.name} ({x.unit})</option>)}</select>
        <Button variant="outline" disabled={!pick} onClick={() => { const x = tradeItems.find((i) => i.id === pick); if (!x) return; set({ lines: [...p.lines, { id: crypto.randomUUID(), item_id: x.id, category: x.category, name: x.name, method: x.installation_method ?? "", unit: x.unit, quantity: 1, rate: Number(x.unit_rate), vat: Number(x.vat_rate) }] }); setPick(""); }}>Add</Button>
        <Button variant="ghost" onClick={() => set({ lines: [...p.lines, { id: crypto.randomUUID(), category: "", name: "", unit: "each", quantity: 1, rate: 0, vat: Number(p.terms.offer_vat || 18) }] })}><Plus className="mr-1 h-4 w-4" />Custom row</Button>
      </div>
      {!tradeItems.length && <p className="text-xs text-muted-foreground">Your price list has no items for this trade yet — add them in Company settings → Price list, or use custom rows.</p>}
      {p.lines.map((l, i) => <div key={l.id} className="grid grid-cols-2 gap-2 border-b pb-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_80px_100px_70px_110px_auto_40px] md:items-center">
        <Input aria-label="Item" className="col-span-2 md:col-span-1" placeholder="Item" value={l.name} onChange={(e) => line(i, { name: e.target.value })} />
        <Input aria-label="Installation method" placeholder="Method" value={l.method ?? ""} onChange={(e) => line(i, { method: e.target.value })} />
        <Input aria-label="Quantity" type="number" min={0} step="0.01" value={l.quantity} onChange={(e) => line(i, { quantity: Number(e.target.value) })} />
        <Input aria-label="Rate" type="number" min={0} step="0.01" value={l.rate} onChange={(e) => line(i, { rate: Number(e.target.value) })} />
        <Input aria-label="VAT %" type="number" min={0} max={100} value={l.vat} onChange={(e) => line(i, { vat: Number(e.target.value) })} />
        <span className="text-right text-sm tabular-nums">{money(lineTotal(l.quantity, l.rate, 0).net)}</span>
        <label className="flex items-center gap-1 text-xs"><Checkbox checked={!!l.optional} onCheckedChange={(v) => line(i, { optional: !!v })} />Option</label>
        <Button size="icon" variant="ghost" aria-label="Remove row" onClick={() => set({ lines: p.lines.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
      </div>)}
      <p className="text-xs text-muted-foreground">Rows ticked "Option" appear as priced alternatives (e.g. a different door finish) and are not added to the total.</p>
    </section>

    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Our offer</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="pr-net">{p.trade === "elevator" ? "Lift net price (excl. VAT)" : "Lump sum (excl. VAT, optional)"}</Label><Input id="pr-net" type="number" min={0} step="0.01" value={p.terms.offer_net} onChange={(e) => terms({ offer_net: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="pr-vat">VAT %</Label><Input id="pr-vat" type="number" min={0} max={100} value={p.terms.offer_vat} onChange={(e) => terms({ offer_vat: e.target.value })} /></div>
      </div>
      <div className="grid max-w-sm grid-cols-2 gap-1 text-sm"><span>Net</span><span className="text-right tabular-nums">{money(totals.net)}</span><span>VAT</span><span className="text-right tabular-nums">{money(totals.vat)}</span><span className="font-semibold">Total</span><span className="text-right font-semibold tabular-nums">{money(totals.total)}</span></div>
    </section>

    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Commercial terms</h2>
      <div className="space-y-2"><Label>Payment terms</Label>{p.terms.payment.map((x, i) => <Input key={i} aria-label={`Payment term ${i + 1}`} placeholder={`Line ${i + 1}`} value={x} onChange={(e) => terms({ payment: p.terms.payment.map((y, j) => j === i ? e.target.value : y) })} />)}</div>
      <div className="space-y-1"><Label htmlFor="pr-others">Others (what is / isn't included)</Label><Textarea id="pr-others" value={p.terms.others} onChange={(e) => terms({ others: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="pr-wy">Guarantee (years)</Label><Input id="pr-wy" type="number" min={0} max={20} value={p.terms.warranty_years} onChange={(e) => terms({ warranty_years: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="pr-wc">Guarantee covers</Label><select id="pr-wc" className={sel} value={p.terms.warranty_cover} onChange={(e) => terms({ warranty_cover: e.target.value })}>{["Parts and labour", "Labour only", "Parts only"].map((o) => <option key={o}>{o}</option>)}</select></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="pr-wn">Guarantee conditions</Label><Textarea id="pr-wn" value={p.terms.warranty_notes} onChange={(e) => terms({ warranty_notes: e.target.value })} /></div>
      </div>
      <ListEditor label="Items to be provided by the client" items={p.terms.client_items} onChange={(client_items) => terms({ client_items })} />
      <ListEditor label="Exclusions" items={p.terms.exclusions} onChange={(exclusions) => terms({ exclusions })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="pr-del">Delivery time</Label><Input id="pr-del" placeholder="e.g. 12–16 weeks" value={p.terms.delivery} onChange={(e) => terms({ delivery: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="pr-deln">Delivery notes</Label><Input id="pr-deln" value={p.terms.delivery_notes} onChange={(e) => terms({ delivery_notes: e.target.value })} /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="pr-notes">Notes for the client</Label><Textarea id="pr-notes" value={p.terms.notes} onChange={(e) => terms({ notes: e.target.value })} /></div>
    </section>

    <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background py-3">
      <Button disabled={busy} onClick={save}>Save</Button>
      <Button variant="outline" disabled={busy} onClick={pdf}><FileDown className="mr-1 h-4 w-4" />Download A4 PDF</Button>
      {p.status === "draft" && <Button variant="ghost" className="ml-auto" onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Delete draft</Button>}
    </div>
  </div>;
}
