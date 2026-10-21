import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useProfile, isManager } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { TRADES } from "@/lib/price-list";
import { linesFromProposal, tally, variance, varianceValue, type SurveyLine } from "@/lib/as-built";
import type { Line } from "@/lib/proposals";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/as-built")({
  head: () => ({ meta: [
    { title: "Site survey — FieldBridge" },
    { name: "description", content: "Count installed points and fittings on site and compare them with the estimate." },
    { property: "og:title", content: "Site survey — FieldBridge" },
    { property: "og:description", content: "Mobile as-built quantity tally with estimate-versus-installed comparison and office sign-off." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AsBuiltPage,
});

const sel = "h-10 w-full rounded-md border bg-background px-3 text-foreground";
const STATUS: Record<string, string> = { draft: "In progress", submitted: "Awaiting sign-off", signed_off: "Signed off" };
type Survey = { id: string; title: string; trade: string; site_label: string; lines: SurveyLine[]; notes: string; status: string; proposal_id: string | null; signed_off_at: string | null };

function AsBuiltPage() {
  const { data: profile } = useProfile();
  const on = usePlanFeatures();
  const [open, setOpen] = useState<string | null>(null);
  if (!profile) return <AppShell title="Site survey"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!on("qs_pricing")) return <AppShell title="Site survey"><EmptyState>Site survey needs the Pricing & quantity surveying module.</EmptyState></AppShell>;
  const manager = isManager(profile);
  return <AppShell title="Site survey">{open ? <Editor id={open} manager={manager} onBack={() => setOpen(null)} /> : <List companyId={profile.company_id} manager={manager} onOpen={setOpen} />}</AppShell>;
}

function List({ companyId, manager, onOpen }: { companyId: string; manager: boolean; onOpen: (id: string) => void }) {
  const [trade, setTrade] = useState("electrical");
  const [proposal, setProposal] = useState("");
  const q = useQuery({ queryKey: ["qs_surveys"], queryFn: async () => { const r = await supabase.from("qs_surveys").select("id, title, trade, site_label, status, updated_at").order("updated_at", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  const props = useQuery({ enabled: manager, queryKey: ["proposals-for-survey"], queryFn: async () => { const r = await supabase.from("proposals").select("id, reference, title, trade, lines").order("updated_at", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  const create = async () => {
    const p = props.data?.find((x) => x.id === proposal);
    const lines = p ? linesFromProposal((Array.isArray(p.lines) ? p.lines : []) as unknown as Line[]) : [];
    const r = await supabase.from("qs_surveys").insert({ company_id: companyId, trade: p?.trade ?? trade, proposal_id: p?.id ?? null, title: p ? `Site survey — ${p.reference} ${p.title}`.trim() : "New site survey", lines: lines as unknown as Json }).select("id").single();
    if (r.error) { toast.error(r.error.message); return; } onOpen(r.data.id);
  };
  return <div className="mx-auto max-w-4xl space-y-4">
    <div className="flex flex-wrap items-end gap-2">
      {manager && <div className="min-w-56 flex-1 space-y-1"><Label htmlFor="ab-prop">Start from proposal</Label><select id="ab-prop" className={sel} value={proposal} onChange={(e) => setProposal(e.target.value)}><option value="">No proposal (blank)</option>{props.data?.map((p) => <option key={p.id} value={p.id}>{p.reference} {p.title}</option>)}</select></div>}
      {!proposal && <div className="min-w-48 space-y-1"><Label htmlFor="ab-trade">Trade</Label><select id="ab-trade" className={sel} value={trade} onChange={(e) => setTrade(e.target.value)}>{TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>}
      <Button onClick={create}><Plus className="mr-1 h-4 w-4" />New survey</Button>
    </div>
    {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : !q.data?.length ? <EmptyState>No site surveys yet.</EmptyState> :
      <ul className="space-y-2">{q.data.map((s) => <li key={s.id}><button className="w-full rounded-xl border bg-card p-4 text-left hover:bg-muted/40" onClick={() => onOpen(s.id)}>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[s.status]}</span><span className="text-xs text-muted-foreground">{TRADES.find((t) => t.key === s.trade)?.label}</span></div>
        <p className="mt-1 font-medium">{s.title || "Untitled"}{s.site_label ? ` · ${s.site_label}` : ""}</p>
      </button></li>)}</ul>}
  </div>;
}

function Editor({ id, manager, onBack }: { id: string; manager: boolean; onBack: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["qs_survey", id], queryFn: async () => { const r = await supabase.from("qs_surveys").select("id, title, trade, site_label, lines, notes, status, proposal_id, signed_off_at").eq("id", id).single(); if (r.error) throw r.error; return { ...r.data, lines: (Array.isArray(r.data.lines) ? r.data.lines : []) as unknown as SurveyLine[] } as Survey; } });
  const items = useQuery({ queryKey: ["price-items-survey"], queryFn: async () => { const r = await supabase.from("company_price_list_items").select("id, trade, category, name, unit, is_tally").order("category"); return r.error ? [] : r.data; } });
  const rates = useQuery({ enabled: manager && !!q.data?.proposal_id, queryKey: ["survey-rates", q.data?.proposal_id], queryFn: async () => { const r = await supabase.from("proposals").select("lines").eq("id", q.data!.proposal_id!).single(); return r.error ? [] : ((r.data.lines ?? []) as unknown as Line[]); } });
  const [s, setS] = useState<Survey | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  if (!s) return <p className="text-muted-foreground">Loading…</p>;
  const locked = s.status === "signed_off";
  const set = (p: Partial<Survey>) => setS({ ...s, ...p });
  const line = (i: number, p: Partial<SurveyLine>) => set({ lines: s.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const tradeItems = (items.data ?? []).filter((x) => x.trade === s.trade);
  const save = async (status?: string) => {
    setBusy(true);
    const r = await supabase.from("qs_surveys").update({ title: s.title, site_label: s.site_label, notes: s.notes, lines: s.lines as unknown as Json, ...(status ? { status } : {}) }).eq("id", id);
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(status === "signed_off" ? "Signed off" : status === "submitted" ? "Sent for sign-off" : "Saved");
    qc.invalidateQueries({ queryKey: ["qs_survey", id] }); qc.invalidateQueries({ queryKey: ["qs_surveys"] });
  };
  const rateFor = (l: SurveyLine) => { const m = rates.data?.find((x) => (l.item_id && x.item_id === l.item_id) || x.name === l.name); return m ? Number(m.rate) : undefined; };
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(n);

  return <div className="mx-auto max-w-4xl space-y-5 print:max-w-none">
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />All surveys</Button>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[s.status]}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print final quantities</Button>
        {!locked && <Button variant="outline" disabled={busy} onClick={() => save()}>Save</Button>}
        {s.status === "draft" && <Button disabled={busy} onClick={() => save("submitted")}>Send for sign-off</Button>}
        {s.status === "submitted" && manager && <><Button variant="outline" disabled={busy} onClick={() => save("draft")}>Send back</Button><Button disabled={busy} onClick={() => save("signed_off")}>Sign off</Button></>}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor="ab-title">Title</Label><Input id="ab-title" disabled={locked} value={s.title} onChange={(e) => set({ title: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="ab-site">Site / area</Label><Input id="ab-site" disabled={locked} value={s.site_label} onChange={(e) => set({ site_label: e.target.value })} /></div>
    </div>

    {!locked && <div className="flex flex-wrap gap-2 print:hidden">
      <select aria-label="Add item" className={`${sel} sm:max-w-md`} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add from price list…</option>{tradeItems.map((x) => <option key={x.id} value={x.id}>{x.category ? `${x.category} — ` : ""}{x.name} ({x.unit})</option>)}</select>
      <Button variant="outline" disabled={!pick} onClick={() => { const x = tradeItems.find((i) => i.id === pick); if (!x) return; set({ lines: [...s.lines, { id: crypto.randomUUID(), item_id: x.id, category: x.category, name: x.name, unit: x.unit, estimated: 0, installed: 0 }] }); setPick(""); }}>Add</Button>
      <Button variant="ghost" onClick={() => set({ lines: [...s.lines, { id: crypto.randomUUID(), category: "", name: "", unit: "each", estimated: 0, installed: 0 }] })}><Plus className="mr-1 h-4 w-4" />Custom item</Button>
    </div>}

    {!s.lines.length ? <EmptyState>No items yet — add what you are counting or measuring.</EmptyState> :
    <ul className="space-y-2">{s.lines.map((l, i) => { const v = variance(l); const counter = l.unit === "each" || l.unit === "point";
      return <li key={l.id} className="rounded-xl border bg-card p-3">
        <div className="flex items-start gap-2">
          {locked || l.item_id ? <p className="flex-1 font-medium">{l.name}<span className="ml-1 text-xs text-muted-foreground">({l.unit})</span></p>
            : <Input aria-label="Item name" className="flex-1" placeholder="Item" value={l.name} onChange={(e) => line(i, { name: e.target.value })} />}
          {!locked && <Button size="icon" variant="ghost" className="print:hidden" aria-label="Remove item" onClick={() => set({ lines: s.lines.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Estimated <b className="tabular-nums text-foreground">{l.estimated}</b></span>
          <div className="flex items-center gap-1">
            {!locked && counter && <Button size="icon" variant="outline" className="h-12 w-12 print:hidden" aria-label={`Remove one ${l.name}`} onClick={() => line(i, tally(l, -1))}><Minus className="h-5 w-5" /></Button>}
            <Input aria-label={`Installed ${l.name}`} disabled={locked} type="number" inputMode="decimal" min={0} step="0.01" className="h-12 w-24 text-center text-lg tabular-nums" value={l.installed} onChange={(e) => line(i, { installed: Math.max(0, Number(e.target.value) || 0) })} />
            {!locked && counter && <Button size="icon" className="h-12 w-12 print:hidden" aria-label={`Add one ${l.name}`} onClick={() => line(i, tally(l, 1))}><Plus className="h-5 w-5" /></Button>}
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.status === "match" ? "bg-muted" : v.status === "over" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
            {v.status === "match" ? "Matches estimate" : `${v.diff > 0 ? "+" : ""}${v.diff}${v.pct != null ? ` (${v.pct > 0 ? "+" : ""}${v.pct}%)` : ""}`}
          </span>
        </div>
        {!locked && <Input aria-label="Item note" className="mt-2 print:hidden" placeholder="Note (optional, e.g. location)" value={l.note ?? ""} onChange={(e) => line(i, { note: e.target.value })} />}
        {locked && l.note && <p className="mt-1 text-xs text-muted-foreground">{l.note}</p>}
      </li>; })}</ul>}

    {manager && s.proposal_id && s.lines.length > 0 && <p className="text-sm">Value of difference at proposal rates: <b className="tabular-nums">{money(varianceValue(s.lines, rateFor))}</b> <span className="text-muted-foreground">(excl. VAT; office and supervisors only)</span></p>}
    <div className="space-y-1"><Label htmlFor="ab-notes">Survey notes</Label><Textarea id="ab-notes" disabled={locked} value={s.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
    {locked && s.signed_off_at && <p className="text-sm text-muted-foreground">Signed off {new Date(s.signed_off_at).toLocaleString()} — final quantities are locked.</p>}
  </div>;
}
