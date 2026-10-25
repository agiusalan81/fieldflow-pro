import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useProfile, isManager } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { formatSiteDisplay } from "@/lib/site-display";
import { clientEstimateView, parsePricing, pricingTotals, type Pricing, type PricingLine } from "@/lib/survey-pricing";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/surveys")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>) => ({ survey: typeof s["survey"] === "string" ? s["survey"] : undefined }),
  head: () => ({ meta: [
    { title: "Site surveys — FieldBridge" },
    { name: "description", content: "Capture site surveys in the field and route them to the right office reviewer for pricing." },
    { property: "og:title", content: "Site surveys — FieldBridge" },
    { property: "og:description", content: "Universal site surveys, delegated office review and a price generator." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SurveysPage,
});

const sel = "h-10 w-full rounded-md border bg-background px-3 text-foreground";
const PURPOSES = [["repair", "Repair / replacement"], ["modernisation", "Modernisation"], ["new_install", "New installation"], ["inspection", "Inspection / audit"], ["other", "Other"]] as const;
const HAZARDS = ["Working at height", "Live electrics", "Confined space", "Asbestos risk", "Public access area", "Hot works", "Heavy lifting"];
const STATUS: Record<string, string> = { draft: "Draft", submitted: "Awaiting review", under_review: "Under review", priced: "Priced", converted: "Converted to estimate", rejected: "Rejected" };
type Item = { label: string; qty: number };
type Survey = {
  id: string; client_id: string | null; site_id: string | null; location_ref: string | null; survey_purpose: string; track: "direct" | "supplier_rfq"; status: string;
  access_notes: string | null; working_window: string | null; hazards: string[]; scope_summary: string | null; recommended_action: string | null; urgency: string;
  labour_hours: number | null; technicians: number | null; materials: Json; other_items: Json; reviewer_id: string | null; created_by: string; pricing: Json; zoho_sync: boolean | null;
  updated_at: string; clients?: { name: string } | null;
};
const items = (v: Json): Item[] => (Array.isArray(v) ? (v as unknown as Item[]) : []);

function SurveysPage() {
  const { data: profile } = useProfile();
  const on = usePlanFeatures();
  const { survey } = Route.useSearch();
  const navigate = useNavigate();
  const open = (id?: string) => void navigate({ to: "/surveys", search: { survey: id } });
  if (!profile) return <AppShell title="Site surveys"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!on("site_surveys")) return <AppShell title="Site surveys"><EmptyState>Site surveys are not included in your plan. Ask your administrator to enable it.</EmptyState></AppShell>;
  return <AppShell title="Site surveys">{survey ? <Editor id={survey} onBack={() => open()} /> : <List onOpen={open} manager={isManager(profile)} superuser={["superuser", "admin"].includes(profile.role)} />}</AppShell>;
}

function List({ onOpen, manager, superuser }: { onOpen: (id: string) => void; manager: boolean; superuser: boolean }) {
  const [filter, setFilter] = useState("open");
  const q = useQuery({ queryKey: ["site-surveys"], queryFn: async () => {
    const r = await supabase.from("site_surveys").select("id,status,track,survey_purpose,location_ref,updated_at,clients(name)").order("updated_at", { ascending: false }).limit(200);
    if (r.error) throw r.error; return r.data;
  } });
  const create = async () => {
    const r = await supabase.from("site_surveys").insert({}).select("id").single();
    if (r.error) { toast.error(r.error.message); return; } onOpen(r.data.id);
  };
  const rows = (q.data ?? []).filter((s) => filter === "all" || (filter === "open" ? !["converted", "rejected"].includes(s.status) : s.status === filter));
  return <div className="mx-auto max-w-5xl space-y-4">
    {superuser && <ReviewSettings />}
    <div className="flex flex-wrap items-end gap-2">
      <Button onClick={create}><Plus className="mr-1 h-4 w-4" />New site survey</Button>
      <div className="ml-auto w-48"><Label htmlFor="survey-filter">Show</Label><select id="survey-filter" className={sel} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="open">Open</option><option value="all">All</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    </div>
    {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : q.error ? <p role="alert" className="text-destructive">Surveys could not be loaded.</p> : !rows.length ? <EmptyState>{manager ? "No site surveys match this filter." : "You have no site surveys yet."}</EmptyState> :
      <ul className="space-y-2">{rows.map((s) => <li key={s.id}><button className="w-full rounded-xl border bg-card p-4 text-left hover:bg-muted/40" onClick={() => onOpen(s.id)}>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[s.status] ?? s.status}</span><span className="text-xs text-muted-foreground">{s.track === "supplier_rfq" ? "Supplier quotes needed" : "Direct office estimate"}</span></div>
        <p className="mt-1 font-medium">{s.clients?.name ?? "No client yet"}{s.location_ref ? ` · ${s.location_ref}` : ""}</p>
        <p className="text-xs text-muted-foreground">{PURPOSES.find((p) => p[0] === s.survey_purpose)?.[1]} · updated {new Date(s.updated_at).toLocaleString()}</p>
      </button></li>)}</ul>}
  </div>;
}

function useTeam() {
  return useQuery({ queryKey: ["survey-team"], queryFn: async () => {
    const [u, r] = await Promise.all([supabase.from("users").select("id,full_name"), supabase.from("user_roles").select("user_id,role,registration_status")]);
    if (u.error) throw u.error;
    const roles = new Map((r.data ?? []).filter((x) => x.registration_status === "active").map((x) => [x.user_id, x.role as string]));
    return (u.data ?? []).filter((x) => ["superuser", "admin", "supervisor"].includes(roles.get(x.id) ?? "")).map((x) => ({ id: x.id, name: x.full_name, role: roles.get(x.id)! }));
  } });
}
const roleLabel: Record<string, string> = { superuser: "Company Superuser", admin: "Office Admin", supervisor: "Supervisor" };

function ReviewSettings() {
  const qc = useQueryClient();
  const team = useTeam();
  const q = useQuery({ queryKey: ["survey-settings"], queryFn: async () => {
    const r = await supabase.from("company_settings").select("company_id,survey_reviewer_mode,survey_reviewer_user_id,zoho_sync_direct,zoho_sync_supplier").maybeSingle();
    if (r.error) throw r.error; return r.data;
  } });
  const [open, setOpen] = useState(false);
  if (!q.data) return null;
  const save = async (patch: Partial<NonNullable<typeof q.data>>) => {
    const r = await supabase.from("company_settings").update(patch).eq("company_id", q.data!.company_id);
    if (r.error) toast.error(r.error.message); else { toast.success("Survey routing saved"); void qc.invalidateQueries({ queryKey: ["survey-settings"] }); }
  };
  return <section className="rounded-xl border bg-card p-4">
    <button className="w-full text-left font-medium" onClick={() => setOpen(!open)}>Review routing & accounting sync {open ? "▴" : "▾"}</button>
    {open && <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="rev-mode">Default survey reviewer</Label>
        <select id="rev-mode" className={sel} value={q.data.survey_reviewer_mode} onChange={(e) => void save({ survey_reviewer_mode: e.target.value })}><option value="office">Any office manager (shared queue)</option><option value="user">A specific person</option></select>
        {q.data.survey_reviewer_mode === "user" && <select aria-label="Default reviewer" className={sel} value={q.data.survey_reviewer_user_id ?? ""} onChange={(e) => void save({ survey_reviewer_user_id: e.target.value || null })}><option value="">Choose…</option>{team.data?.map((m) => <option key={m.id} value={m.id}>{m.name} · {roleLabel[m.role]}</option>)}</select>}
      </div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Send estimates to accounting (Zoho Books) by default</legend>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={q.data.zoho_sync_direct} onCheckedChange={(v) => void save({ zoho_sync_direct: v === true })} />Repairs & direct office estimates</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={q.data.zoho_sync_supplier} onCheckedChange={(v) => void save({ zoho_sync_supplier: v === true })} />Work needing supplier quotes (e.g. new installations)</label>
        <p className="text-xs text-muted-foreground">Supplier quotes themselves are never sent to accounting or clients.</p>
      </fieldset>
    </div>}
  </section>;
}

function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const team = useTeam();
  const q = useQuery({ queryKey: ["site-survey", id], queryFn: async () => { const r = await supabase.from("site_surveys").select("*").eq("id", id).single(); if (r.error) throw r.error; return r.data as unknown as Survey; } });
  const clients = useQuery({ queryKey: ["survey-clients"], queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [] });
  const [s, setS] = useState<Survey | null>(null);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  const sites = useQuery({ queryKey: ["client-sites", s?.client_id], enabled: !!s?.client_id, queryFn: async () => (await supabase.from("sites").select("*").eq("client_id", s!.client_id!).order("name")).data ?? [] });
  const [busy, setBusy] = useState(false);
  if (q.error) return <p role="alert" className="text-destructive">This survey is not available to you.</p>;
  if (!s || !profile) return <p className="text-muted-foreground">Loading…</p>;
  const office = isManager(profile) || s.reviewer_id === profile.id;
  const editable = s.status === "draft" && (s.created_by === profile.id || office);
  const set = (patch: Partial<Survey>) => setS({ ...s, ...patch });

  const persist = async (patch: Partial<Survey> = {}) => {
    setBusy(true);
    const next = { ...s, ...patch };
    const { id: _id, created_by: _c, updated_at: _u, clients: _cl, ...row } = next;
    const writable = office ? row : (({ pricing: _p, zoho_sync: _z, ...rest }) => rest)(row);
    const r = await supabase.from("site_surveys").update(writable as never).eq("id", id).select("*").single();
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return false; }
    setS(r.data as unknown as Survey);
    await Promise.all([qc.invalidateQueries({ queryKey: ["site-surveys"] }), qc.invalidateQueries({ queryKey: ["action-notifications"] })]);
    return true;
  };
  const submit = async () => {
    if (!s.client_id || !s.site_id || !s.scope_summary?.trim()) { toast.error("Choose a client and site and describe the scope before submitting."); return; }
    if (await persist({ status: "submitted" })) toast.success("Survey sent for office review");
  };
  const remove = async () => { if (!confirm("Delete this draft survey?")) return; const r = await supabase.from("site_surveys").delete().eq("id", id); if (r.error) toast.error(r.error.message); else { void qc.invalidateQueries({ queryKey: ["site-surveys"] }); onBack(); } };

  return <div className="mx-auto max-w-4xl space-y-5">
    <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />All surveys</Button><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[s.status]}</span></div>
    <fieldset disabled={!editable} className="space-y-4 rounded-xl border bg-card p-4">
      <legend className="px-1 font-medium">Survey details</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="sv-client">Client</Label><select id="sv-client" className={sel} value={s.client_id ?? ""} onChange={(e) => set({ client_id: e.target.value || null, site_id: null })}><option value="">Choose client…</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><Label htmlFor="sv-site">Site / Location</Label><select id="sv-site" className={sel} value={s.site_id ?? ""} onChange={(e) => set({ site_id: e.target.value || null })} disabled={!s.client_id}><option value="">Choose site…</option>{sites.data?.map((x) => <option key={x.id} value={x.id}>{formatSiteDisplay(x)}</option>)}</select></div>
        <div><Label htmlFor="sv-loc">Equipment / location reference</Label><Input id="sv-loc" placeholder="e.g. Lift 2, Plant room B" value={s.location_ref ?? ""} onChange={(e) => set({ location_ref: e.target.value })} /></div>
        <div><Label htmlFor="sv-purpose">Survey purpose</Label><select id="sv-purpose" className={sel} value={s.survey_purpose} onChange={(e) => set({ survey_purpose: e.target.value, track: e.target.value === "new_install" ? "supplier_rfq" : s.track })}>{PURPOSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      </div>
      <fieldset className="space-y-1"><legend className="text-sm font-medium">How will this be priced?</legend>
        {([["direct", "Office prices directly from our price list (repairs, replacements)"], ["supplier_rfq", "Supplier quotes needed first (new installations, major equipment)"]] as const).map(([k, v]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="track" checked={s.track === k} onChange={() => set({ track: k })} />{v}</label>)}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="sv-access">Access & logistics</Label><Textarea id="sv-access" value={s.access_notes ?? ""} onChange={(e) => set({ access_notes: e.target.value })} /></div>
        <div><Label htmlFor="sv-window">Working window</Label><Input id="sv-window" placeholder="e.g. Weekdays after 18:00" value={s.working_window ?? ""} onChange={(e) => set({ working_window: e.target.value })} /></div>
      </div>
      <fieldset><legend className="text-sm font-medium">Site hazards</legend><div className="mt-1 grid gap-1 sm:grid-cols-2">{HAZARDS.map((h) => <label key={h} className="flex items-center gap-2 text-sm"><Checkbox checked={s.hazards.includes(h)} onCheckedChange={(v) => set({ hazards: v ? [...s.hazards, h] : s.hazards.filter((x) => x !== h) })} />{h}</label>)}</div></fieldset>
      <div><Label htmlFor="sv-scope">Scope summary</Label><Textarea id="sv-scope" rows={4} value={s.scope_summary ?? ""} onChange={(e) => set({ scope_summary: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="sv-rec">Recommended action</Label><Input id="sv-rec" value={s.recommended_action ?? ""} onChange={(e) => set({ recommended_action: e.target.value })} /></div>
        <div><Label htmlFor="sv-hours">Estimated labour hours</Label><Input id="sv-hours" inputMode="decimal" value={s.labour_hours ?? ""} onChange={(e) => set({ labour_hours: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        <div><Label htmlFor="sv-techs">Technicians needed</Label><Input id="sv-techs" inputMode="numeric" value={s.technicians ?? ""} onChange={(e) => set({ technicians: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        <div><Label htmlFor="sv-urg">Urgency</Label><select id="sv-urg" className={sel} value={s.urgency} onChange={(e) => set({ urgency: e.target.value })}><option value="routine">Routine</option><option value="soon">Within 2 weeks</option><option value="urgent">Urgent</option></select></div>
      </div>
      <ItemList label="Materials & equipment needed" value={items(s.materials)} onChange={(v) => set({ materials: v as unknown as Json })} />
      <ItemList label="Other items not in our lists (sent to FieldBridge for future templates)" value={items(s.other_items)} onChange={(v) => set({ other_items: v as unknown as Json })} />
    </fieldset>
    {(editable || office) && <div className="flex flex-wrap items-end gap-2">
      <div className="w-72"><Label htmlFor="sv-rev">Reviewer</Label><select id="sv-rev" className={sel} value={s.reviewer_id ?? ""} onChange={(e) => office && s.status !== "draft" ? void persist({ reviewer_id: e.target.value || null }) : set({ reviewer_id: e.target.value || null })}><option value="">Company default</option>{team.data?.map((m) => <option key={m.id} value={m.id}>{m.name} · {roleLabel[m.role]}</option>)}</select></div>
      {editable && <><Button variant="outline" disabled={busy} onClick={() => void persist().then((ok) => ok && toast.success("Draft saved"))}>Save draft</Button><Button disabled={busy} onClick={() => void submit()}><Send className="mr-1 h-4 w-4" />Submit for review</Button><Button variant="ghost" disabled={busy} onClick={() => void remove()}><Trash2 className="mr-1 h-4 w-4" />Delete</Button></>}
    </div>}
    {office && s.status !== "draft" && <PriceGenerator survey={s} busy={busy} persist={persist} />}
  </div>;
}

function ItemList({ label, value, onChange }: { label: string; value: Item[]; onChange: (v: Item[]) => void }) {
  return <div className="space-y-2"><Label>{label}</Label>
    {value.map((it, i) => <div key={i} className="flex gap-2"><Input aria-label={`${label} item ${i + 1}`} value={it.label} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /><Input aria-label={`${label} quantity ${i + 1}`} className="w-24" inputMode="decimal" value={it.qty} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) || 0 } : x))} /><Button type="button" size="icon" variant="ghost" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { label: "", qty: 1 }])}><Plus className="mr-1 h-4 w-4" />Add item</Button>
  </div>;
}

const money = (v: number) => `€${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PriceGenerator({ survey, busy, persist }: { survey: Survey; busy: boolean; persist: (p: Partial<Survey>) => Promise<boolean> }) {
  const [p, setP] = useState<Pricing>(() => {
    const x = parsePricing(survey.pricing);
    if (!x.labour.length && survey.labour_hours) x.labour = [{ label: "Labour", people: survey.technicians ?? 1, hours: survey.labour_hours / Math.max(1, survey.technicians ?? 1), rate: 0 }];
    return x;
  });
  const [zoho, setZoho] = useState<boolean>(survey.zoho_sync ?? survey.track === "direct");
  const t = pricingTotals(p), client = clientEstimateView(p);
  const lines = (key: "base" | "logistics" | "site", title: string) => <div className="space-y-2"><Label>{title}</Label>
    {p[key].map((l: PricingLine, i) => <div key={i} className="flex gap-2"><Input aria-label={`${title} ${i + 1}`} value={l.label} onChange={(e) => setP({ ...p, [key]: p[key].map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} /><Input aria-label={`${title} amount ${i + 1}`} className="w-32" inputMode="decimal" value={l.amount} onChange={(e) => setP({ ...p, [key]: p[key].map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x) })} /><Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setP({ ...p, [key]: p[key].filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>)}
    <Button size="sm" variant="outline" onClick={() => setP({ ...p, [key]: [...p[key], { label: "", amount: 0 }] })}><Plus className="mr-1 h-4 w-4" />Add</Button></div>;
  const save = (status?: string) => void persist({ pricing: p as unknown as Json, zoho_sync: zoho, ...(status ? { status } : survey.status === "submitted" ? { status: "under_review" } : {}) }).then((ok) => ok && toast.success("Pricing saved"));
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <h2 className="font-semibold">Office price generator <span className="text-xs font-normal text-muted-foreground">(internal — never shown to the client)</span></h2>
    {survey.track === "supplier_rfq" && <p className="border-l-2 border-primary bg-muted p-2 text-sm">Enter the supplier's quoted price you selected under "Base cost". Supplier quotes stay internal and are never sent to clients or accounting.</p>}
    {lines("base", survey.track === "supplier_rfq" ? "Base cost (selected supplier quote)" : "Materials & parts cost")}
    {lines("logistics", "Freight, clearance & transport")}
    {lines("site", "Site logistics & equipment hire")}
    <div className="space-y-2"><Label>Labour</Label>
      {p.labour.map((l, i) => <div key={i} className="grid grid-cols-[1fr_5rem_5rem_6rem_auto] gap-2"><Input aria-label={`Labour ${i + 1}`} value={l.label} onChange={(e) => setP({ ...p, labour: p.labour.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />{(["people", "hours", "rate"] as const).map((k) => <Input key={k} aria-label={`Labour ${k} ${i + 1}`} placeholder={k} inputMode="decimal" value={l[k]} onChange={(e) => setP({ ...p, labour: p.labour.map((x, j) => j === i ? { ...x, [k]: Number(e.target.value) || 0 } : x) })} />)}<Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setP({ ...p, labour: p.labour.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>)}
      <Button size="sm" variant="outline" onClick={() => setP({ ...p, labour: [...p.labour, { label: "", people: 1, hours: 1, rate: 0 }] })}><Plus className="mr-1 h-4 w-4" />Add labour</Button></div>
    <div className="grid gap-3 sm:grid-cols-3">{([["contingencyPct", "Contingency %"], ["marginPct", "Target margin %"], ["vatPct", "VAT %"]] as const).map(([k, v]) => <div key={k}><Label htmlFor={`pg-${k}`}>{v}</Label><Input id={`pg-${k}`} inputMode="decimal" value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) || 0 })} /></div>)}</div>
    <dl className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-4"><dt className="text-muted-foreground">Internal cost</dt><dd>{money(t.cost)}</dd><dt className="text-muted-foreground">Profit</dt><dd>{money(t.profit)}</dd></dl>
    <div><Label htmlFor="pg-desc">Client-facing description</Label><Textarea id="pg-desc" rows={3} placeholder="Rewrite the scope in plain client language" value={p.clientDescription} onChange={(e) => setP({ ...p, clientDescription: e.target.value })} /></div>
    <div className="rounded-lg border p-3"><p className="text-sm font-medium">Client estimate preview</p><p className="whitespace-pre-wrap text-sm">{client.description || "—"}</p><p className="mt-2 text-sm">Total excl. VAT {money(client.net)} · VAT {client.vatPct}% {money(client.vat)} · <span className="font-semibold">Total {money(client.gross)}</span></p></div>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={zoho} onCheckedChange={(v) => setZoho(v === true)} />Send the client estimate to accounting (Zoho Books) as a draft</label>
    <div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => save()}>Save pricing</Button><Button disabled={busy} onClick={() => save("priced")}>Mark priced</Button><Button disabled={busy} variant="ghost" onClick={() => save("rejected")}>Reject survey</Button><Button asChild variant="link"><Link to="/estimates">Open estimates</Link></Button></div>
  </section>;
}
