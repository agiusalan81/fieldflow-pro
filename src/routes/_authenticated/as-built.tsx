import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Camera, Minus, Plus, Printer, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useProfile, isManager } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { TRADES } from "@/lib/price-list";
import { useCompanyRules } from "@/lib/company";
import { finalAccount, finalQty, linesFromProposal, tally, unresolved, variance, varianceValue, type ReviewDecision, type SurveyLine, type SurveyReview } from "@/lib/as-built";
import type { Line } from "@/lib/proposals";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/as-built")({ staticData: { sitemap: false },
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
const STATUS: Record<string, string> = { draft: "In progress", submitted: "Awaiting sign-off", signed_off: "Signed off — awaiting office review", closed: "Closed — final account" };
type Survey = { id: string; title: string; trade: string; site_label: string; lines: SurveyLine[]; notes: string; status: string; proposal_id: string | null; signed_off_at: string | null; review: SurveyReview; closed_at: string | null };

function AsBuiltPage() {
  const { data: profile } = useProfile();
  const on = usePlanFeatures();
  const [open, setOpen] = useState<string | null>(null);
  if (!profile) return <AppShell title="Site survey"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!on("qs_pricing")) return <AppShell title="Site survey"><EmptyState>Site survey needs the Pricing & quantity surveying module.</EmptyState></AppShell>;
  const manager = isManager(profile);
  return <AppShell title="Site survey">{open ? <Editor id={open} manager={manager} companyId={profile.company_id} onBack={() => setOpen(null)} /> : <List companyId={profile.company_id} manager={manager} onOpen={setOpen} />}</AppShell>;
}

function List({ companyId, manager, onOpen }: { companyId: string; manager: boolean; onOpen: (id: string) => void }) {
  const company = useCompanyRules();
  const chosen = company.data?.trades ?? [];
  const trades = chosen.length ? TRADES.filter((t) => chosen.includes(t.key)) : TRADES;
  const [trade, setTrade] = useState("electrical");
  useEffect(() => { if (!trades.some((t) => t.key === trade) && trades[0]) setTrade(trades[0].key); }, [trades, trade]);
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
      {!proposal && <div className="min-w-48 space-y-1"><Label htmlFor="ab-trade">Trade</Label><select id="ab-trade" className={sel} value={trade} onChange={(e) => setTrade(e.target.value)}>{trades.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>}
      <Button onClick={create}><Plus className="mr-1 h-4 w-4" />New survey</Button>
    </div>
    {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : !q.data?.length ? <EmptyState>No site surveys yet.</EmptyState> :
      <ul className="space-y-2">{q.data.map((s) => <li key={s.id}><button className="w-full rounded-xl border bg-card p-4 text-left hover:bg-muted/40" onClick={() => onOpen(s.id)}>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[s.status]}</span><span className="text-xs text-muted-foreground">{TRADES.find((t) => t.key === s.trade)?.label}</span></div>
        <p className="mt-1 font-medium">{s.title || "Untitled"}{s.site_label ? ` · ${s.site_label}` : ""}</p>
      </button></li>)}</ul>}
  </div>;
}

function RowPhotos({ companyId, surveyId, paths, locked, onChange }: { companyId: string; surveyId: string; paths: string[]; locked: boolean; onChange: (p: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const urls = useQuery({ enabled: paths.length > 0, queryKey: ["survey-photo-urls", ...paths], queryFn: async () => {
    const r = await supabase.storage.from("job-photos").createSignedUrls(paths, 3600);
    return Object.fromEntries((r.data ?? []).map((x) => [x.path, x.signedUrl]));
  } });
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${companyId}/site-surveys/${surveyId}/${crypto.randomUUID()}.${ext}`;
      const r = await supabase.storage.from("job-photos").upload(path, f, { contentType: f.type || "image/jpeg" });
      if (r.error) toast.error(r.error.message); else added.push(path);
    }
    setBusy(false);
    if (added.length) { onChange([...paths, ...added]); toast.success("Photo added — remember to save"); }
  };
  const del = async (p: string) => { await supabase.storage.from("job-photos").remove([p]); onChange(paths.filter((x) => x !== p)); };
  if (locked && !paths.length) return null;
  return <div className="mt-2 flex flex-wrap items-center gap-2">
    {paths.map((p) => <div key={p} className="relative">
      {urls.data?.[p] ? <button type="button" onClick={() => setView(urls.data![p])}><img src={urls.data[p]} alt="Survey row photo" className="h-16 w-16 rounded-md border object-cover" /></button> : <div className="h-16 w-16 rounded-md border bg-muted" />}
      {!locked && <button type="button" aria-label="Remove photo" className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground print:hidden" onClick={() => del(p)}><X className="h-3 w-3" /></button>}
    </div>)}
    {!locked && <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/40 print:hidden">
      <Camera className="h-5 w-5" />{busy ? "…" : "Photo"}
      <input type="file" accept="image/*" capture="environment" multiple className="hidden" disabled={busy} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
    </label>}
    {view && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4" onClick={() => setView(null)}><img src={view} alt="Survey row photo enlarged" className="max-h-full max-w-full rounded-lg" /></div>}
  </div>;
}

function Editor({ id, manager, companyId, onBack }: { id: string; manager: boolean; companyId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["qs_survey", id], queryFn: async () => { const r = await supabase.from("qs_surveys").select("id, title, trade, site_label, lines, notes, status, proposal_id, signed_off_at, review, closed_at").eq("id", id).single(); if (r.error) throw r.error; return { ...r.data, lines: (Array.isArray(r.data.lines) ? r.data.lines : []) as unknown as SurveyLine[], review: ((r.data.review && typeof r.data.review === "object" && !Array.isArray(r.data.review)) ? r.data.review : {}) as unknown as SurveyReview } as Survey; } });
  const items = useQuery({ queryKey: ["price-items-survey"], queryFn: async () => { const r = await supabase.from("company_price_list_items").select("id, trade, category, name, unit, is_tally").order("category"); return r.error ? [] : r.data; } });
  const rates = useQuery({ enabled: manager && !!q.data?.proposal_id, queryKey: ["survey-rates", q.data?.proposal_id], queryFn: async () => { const r = await supabase.from("proposals").select("lines").eq("id", q.data!.proposal_id!).single(); return r.error ? [] : ((r.data.lines ?? []) as unknown as Line[]); } });
  const [s, setS] = useState<Survey | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  if (!s) return <p className="text-muted-foreground">Loading…</p>;
  const locked = s.status === "signed_off" || s.status === "closed";
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
  const remove = async () => {
    if (!window.confirm(`Delete "${s.title || "this survey"}"? This cannot be undone.`)) return;
    setBusy(true);
    const r = await supabase.from("qs_surveys").delete().eq("id", id).select("id");
    setBusy(false);
    if (r.error || !r.data?.length) { toast.error(r.error?.message ?? "Only office or supervisors can delete draft surveys."); return; }
    const paths = s.lines.flatMap((l) => l.photos ?? []);
    if (paths.length) await supabase.storage.from("job-photos").remove(paths);
    toast.success("Survey deleted"); qc.invalidateQueries({ queryKey: ["qs_surveys"] }); onBack();
  };
  const rateFor = (l: SurveyLine) => { const m = rates.data?.find((x) => (l.item_id && x.item_id === l.item_id) || x.name === l.name); return m ? Number(m.rate) : undefined; };
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(n);

  return <div className="mx-auto max-w-4xl space-y-5 print:max-w-none">
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />All surveys</Button>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[s.status]}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />{s.status === "closed" ? "Print final account" : "Print quantities"}</Button>
        {manager && s.status === "draft" && <Button variant="outline" className="text-destructive" disabled={busy} onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Delete survey</Button>}
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
        <RowPhotos companyId={companyId} surveyId={id} paths={l.photos ?? []} locked={locked} onChange={(photos) => line(i, { photos })} />
      </li>; })}</ul>}

    {manager && s.proposal_id && s.lines.length > 0 && <p className="text-sm">Value of difference at proposal rates: <b className="tabular-nums">{money(varianceValue(s.lines, rateFor))}</b> <span className="text-muted-foreground">(excl. VAT; office and supervisors only)</span></p>}
    <div className="space-y-1"><Label htmlFor="ab-notes">Survey notes</Label><Textarea id="ab-notes" disabled={locked} value={s.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
    {locked && s.signed_off_at && <p className="text-sm text-muted-foreground">Signed off {new Date(s.signed_off_at).toLocaleString()} — site quantities are locked.</p>}
    {manager && locked && <CloseOut s={s} rateFor={s.proposal_id ? rateFor : undefined} money={money} onSaved={() => { qc.invalidateQueries({ queryKey: ["qs_survey", id] }); qc.invalidateQueries({ queryKey: ["qs_surveys"] }); }} />}
  </div>;
}

const DECISIONS: { key: ReviewDecision["decision"]; label: string }[] = [
  { key: "accept", label: "Charge installed" }, { key: "estimate", label: "Hold to estimate" }, { key: "adjust", label: "Adjust" },
];

/** Phase 5: office variance review and commercial close-out. Signed site quantities are never edited. */
function CloseOut({ s, rateFor, money, onSaved }: { s: Survey; rateFor?: ((l: SurveyLine) => number | undefined) | undefined; money: (n: number) => string; onSaved: () => void }) {
  const [review, setReview] = useState<SurveyReview>(s.review ?? {});
  const [busy, setBusy] = useState(false);
  useEffect(() => setReview(s.review ?? {}), [s.review]);
  const closed = s.status === "closed";
  const open = unresolved(s.lines, review);
  const set = (lineId: string, p: Partial<ReviewDecision>) => setReview((r) => ({ ...r, [lineId]: { decision: "accept", ...r[lineId], ...p } }));
  const acct = rateFor ? finalAccount(s.lines, review, rateFor) : null;
  const save = async (close?: boolean) => {
    if (close && open.length) { toast.error(`${open.length} item(s) still need a decision or reason`); return; }
    if (close && !window.confirm("Close this survey? The final account will be locked.")) return;
    setBusy(true);
    const r = await supabase.from("qs_surveys").update({ review: review as unknown as Json, ...(close ? { status: "closed" } : {}) }).eq("id", s.id);
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(close ? "Survey closed — final account locked" : "Review saved"); onSaved();
  };
  return <section className="space-y-3 rounded-xl border bg-card p-4 print:border-0 print:p-0">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-lg font-semibold">Office review & final account</h2>
      {!closed && <span className="rounded-full bg-muted px-2 py-0.5 text-xs print:hidden">{open.length ? `${open.length} to resolve` : "All resolved"}</span>}
      {!closed && <div className="ml-auto flex gap-2 print:hidden"><Button variant="outline" disabled={busy} onClick={() => save()}>Save review</Button><Button disabled={busy || open.length > 0} onClick={() => save(true)}>Close survey</Button></div>}
    </div>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1 pr-2">Item</th><th className="px-2 text-right">Est.</th><th className="px-2 text-right">Installed</th><th className="px-2">Decision</th><th className="px-2 text-right">Final</th>{rateFor && <th className="pl-2 text-right">Value</th>}</tr></thead>
      <tbody>{s.lines.map((l) => { const d = review[l.id]; const v = variance(l); const fq = finalQty(l, d); const rate = rateFor?.(l); const needs = open.some((x) => x.id === l.id);
        return <tr key={l.id} className={`border-b align-top ${needs ? "bg-destructive/5" : ""}`}>
          <td className="py-2 pr-2">{l.name}<span className="ml-1 text-xs text-muted-foreground">({l.unit})</span>{v.status !== "match" && <span className="ml-1 text-xs text-muted-foreground">{v.diff > 0 ? "+" : ""}{v.diff}</span>}</td>
          <td className="px-2 text-right tabular-nums">{l.estimated}</td>
          <td className="px-2 text-right tabular-nums">{l.installed}</td>
          <td className="px-2">{closed ? <span>{DECISIONS.find((x) => x.key === (d?.decision ?? "accept"))?.label}{d?.reason ? ` — ${d.reason}` : ""}</span> : <div className="space-y-1 print:hidden">
            <select aria-label={`Decision for ${l.name}`} className="h-9 w-full rounded-md border bg-background px-2" value={d?.decision ?? (v.status === "match" ? "accept" : "")} onChange={(e) => set(l.id, { decision: e.target.value as ReviewDecision["decision"] })}>
              {v.status !== "match" && !d && <option value="">Choose…</option>}{DECISIONS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
            {d?.decision === "adjust" && <Input aria-label={`Adjusted quantity for ${l.name}`} type="number" inputMode="decimal" min={0} step="0.01" value={d.qty ?? ""} onChange={(e) => set(l.id, { qty: Number(e.target.value) })} />}
            {d && d.decision !== "accept" && <Input aria-label={`Reason for ${l.name}`} placeholder="Reason (required)" value={d.reason ?? ""} onChange={(e) => set(l.id, { reason: e.target.value })} />}
          </div>}</td>
          <td className="px-2 text-right font-medium tabular-nums">{fq}</td>
          {rateFor && <td className="pl-2 text-right tabular-nums">{rate == null ? "—" : money(fq * rate)}</td>}
        </tr>; })}</tbody>
    </table></div>
    {acct && <div className="grid gap-1 text-sm sm:max-w-sm sm:ml-auto">
      <div className="flex justify-between"><span>Estimate value</span><span className="tabular-nums">{money(acct.estimated)}</span></div>
      <div className="flex justify-between font-semibold"><span>Final account</span><span className="tabular-nums">{money(acct.final)}</span></div>
      <div className="flex justify-between text-muted-foreground"><span>Difference</span><span className="tabular-nums">{acct.difference > 0 ? "+" : ""}{money(acct.difference)}</span></div>
      <p className="text-xs text-muted-foreground">Excl. VAT, at proposal rates. Items without a proposal rate are excluded.</p>
    </div>}
    {closed && s.closed_at && <p className="text-sm text-muted-foreground">Closed {new Date(s.closed_at).toLocaleString()} — final account locked.</p>}
  </section>;
}
