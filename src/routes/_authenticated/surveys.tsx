import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Plus, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useProfile, isManager } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { formatSiteDisplay } from "@/lib/site-display";
import { clientEstimateView, parsePricing, pricingTotals, type Pricing, type PricingLine, type RateUnit } from "@/lib/survey-pricing";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompanyRules } from "@/lib/company";
import { SuggestedTextarea } from "@/components/suggested-textarea";
import { ACCESS_SUGGESTIONS, WORKING_WINDOWS, canSubmitSurvey, surveyItemsPending, parseSurveyDetails, surveyReviewerOptions, surveyTradeLabel, type SurveyDetails, type TradeReview } from "@/lib/survey-details";
import { SurveyContacts, SurveyTrades, SurveyObservations, SurveyTradeReview } from "@/components/survey-field-details";
import { ClientSitePicker } from "@/components/client-site-picker";

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
type Item = { label: string; qty: number; trade?: string };
type Survey = {
  id: string; client_id: string | null; site_id: string | null; location_ref: string | null; survey_purpose: string; track: "direct" | "supplier_rfq"; status: string;
  access_notes: string | null; working_window: string | null; hazards: string[]; scope_summary: string | null; recommended_action: string | null; urgency: string;
  labour_hours: number | null; technicians: number | null; materials: Json; other_items: Json; reviewer_id: string | null; created_by: string; pricing: Json; zoho_sync: boolean | null;
  field_details: Json; trade_review: Json; updated_at: string; clients?: { name: string } | null;
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
  return <AppShell title="Site surveys">{survey ? <Editor id={survey} onBack={() => open()} /> : <List onOpen={open} manager={isManager(profile)} superuser={["superuser", "admin"].includes(profile.role)} canCreate={profile.role !== "admin"} lift={on("lift_pack") && isManager(profile)} />}</AppShell>;
}

function List({ onOpen, manager, superuser, canCreate, lift }: { onOpen: (id: string) => void; manager: boolean; superuser: boolean; canCreate: boolean; lift: boolean }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("open");
  const q = useQuery({ queryKey: ["site-surveys"], queryFn: async () => {
    const r = await supabase.from("site_surveys").select("id,reference,status,track,survey_purpose,location_ref,field_details,materials,other_items,updated_at,clients(name)").order("updated_at", { ascending: false }).limit(200);
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
      {canCreate && (lift ? <DropdownMenu><DropdownMenuTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New site survey<ChevronDown className="ml-1 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-72">
        <DropdownMenuItem onSelect={() => void create()}><div><p className="font-medium">General site survey</p><p className="text-xs text-muted-foreground">Any trade · for general quotes</p></div></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/lift-surveys", search: { new: "1" } })}><div><p className="font-medium">Lift site survey</p><p className="text-xs text-muted-foreground">Stops, shaft depth, pit, headroom</p></div></DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu> : <Button onClick={create}><Plus className="mr-1 h-4 w-4" />New site survey</Button>)}
      {lift && <Button variant="outline" asChild><Link to="/lift-surveys" search={{ new: undefined }}>Lift site surveys</Link></Button>}
      <div className="ml-auto w-48"><Label htmlFor="survey-filter">Show</Label><select id="survey-filter" className={sel} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="open">Open</option><option value="all">All</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    </div>
    {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : q.error ? <p role="alert" className="text-destructive">Surveys could not be loaded.</p> : !rows.length ? <EmptyState>{manager ? "No site surveys match this filter." : "You have no site surveys yet."}</EmptyState> :
      <ul className="space-y-2">{rows.map((s) => <li key={s.id}><button className="w-full rounded-xl border bg-card p-4 text-left hover:bg-muted/40" onClick={() => onOpen(s.id)}>
        <div className="flex flex-wrap items-center gap-2">{s.reference && <span className="font-mono text-xs font-medium">{s.reference}</span>}<span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[s.status] ?? s.status}</span>{s.status === "draft" && surveyItemsPending(items(s.materials), items(s.other_items), parseSurveyDetails(s.field_details)) && <span className="rounded-full border border-primary px-2 py-0.5 text-xs text-primary">Materials to complete</span>}<span className="text-xs text-muted-foreground">{s.track === "supplier_rfq" ? "Supplier quotes needed" : "Direct office estimate"}</span></div>
        <p className="mt-1 font-medium">{s.clients?.name ?? (parseSurveyDetails(s.field_details).clientName || "No client yet")}{s.location_ref ? ` · ${s.location_ref}` : parseSurveyDetails(s.field_details).siteName ? ` · ${parseSurveyDetails(s.field_details).siteName}` : ""}</p>
        <p className="text-xs text-muted-foreground">{PURPOSES.find((p) => p[0] === s.survey_purpose)?.[1]} · updated {new Date(s.updated_at).toLocaleString()}</p>
      </button></li>)}</ul>}
  </div>;
}

function useTeam() {
  return useQuery({ queryKey: ["survey-team"], queryFn: async () => {
    const [u, r] = await Promise.all([supabase.from("users").select("id,full_name"), supabase.from("user_roles").select("user_id,role,registration_status")]);
    if (u.error) throw u.error; if (r.error) throw r.error;
    const roles = new Map((r.data ?? []).filter((x) => x.registration_status === "active").map((x) => [x.user_id, x.role as string]));
    return (u.data ?? []).filter((x) => ["superuser", "admin", "supervisor"].includes(roles.get(x.id) ?? "")).map((x) => ({ id: x.id, name: x.full_name, role: roles.get(x.id) ?? "" }));
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
    const settings = q.data; if (!settings) return;
    const r = await supabase.from("company_settings").update(patch).eq("company_id", settings.company_id);
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
  const company = useCompanyRules();
  const q = useQuery({ queryKey: ["site-survey", id], queryFn: async () => { const r = await supabase.from("site_surveys").select("*").eq("id", id).single(); if (r.error) throw r.error; return r.data as unknown as Survey; } });
  const clients = useQuery({ queryKey: ["survey-clients"], queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [] });
  const [s, setS] = useState<Survey | null>(null);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  const clientId = s?.client_id;
  const sites = useQuery({ queryKey: ["client-sites", clientId], enabled: !!clientId, queryFn: async () => { if (!clientId) return []; const r = await supabase.from("sites").select("*").eq("client_id", clientId).order("name"); if (r.error) throw r.error; return r.data; } });
  const pastAccess = useQuery({ queryKey: ["survey-access-history", profile?.company_id], enabled: !!profile, staleTime: 60_000, queryFn: async () => (await supabase.from("site_surveys").select("access_notes").not("access_notes", "is", null).order("updated_at", { ascending: false }).limit(100)).data ?? [] });
  const accessSuggestions = [...new Set([...ACCESS_SUGGESTIONS, ...(pastAccess.data ?? []).map(x => (x.access_notes ?? "").trim()).filter(Boolean)])];
  const [busy, setBusy] = useState(false);
  if (q.error) return <p role="alert" className="text-destructive">This survey is not available to you.</p>;
  if (!s || !profile) return <p className="text-muted-foreground">Loading…</p>;
  const office = isManager(profile);
  const editable = s.status === "draft" && (s.created_by === profile.id || office);
  const set = (patch: Partial<Survey>) => setS({ ...s, ...patch });
  const details = parseSurveyDetails(s.field_details);
  const setDetails = (value: SurveyDetails) => set({ field_details: value as unknown as Json });
  const reviewers = surveyReviewerOptions(team.data ?? [], office);
  const reviewer = office ? s.reviewer_id : reviewers.some(m => m.id === s.reviewer_id) ? s.reviewer_id : reviewers.length === 1 ? reviewers[0]?.id ?? null : null;

  const persist = async (patch: Partial<Survey> = {}) => {
    setBusy(true);
    const next = { ...s, reviewer_id: reviewer, ...patch };
    const { id: _id, created_by: _c, updated_at: _u, clients: _cl, ...row } = next;
    const writable = office ? row : (({ pricing: _p, zoho_sync: _z, track: _t, trade_review: _tr, ...rest }) => rest)(row);
    const r = await supabase.from("site_surveys").update(writable as never).eq("id", id).select("*").single();
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return false; }
    setS(r.data as unknown as Survey);
    await Promise.all([qc.invalidateQueries({ queryKey: ["site-surveys"] }), qc.invalidateQueries({ queryKey: ["action-notifications"] })]);
    return true;
  };
  const submit = async () => {
    if (!canSubmitSurvey(s, details)) { toast.error("Enter a client, site/location and scope before submitting."); return; }
    if (surveyItemsPending(items(s.materials), items(s.other_items), details)) { toast.error("Add the materials & equipment, or tick “Not applicable”. Save as draft to complete them later."); return; }
    if (!office && !reviewer) { toast.error("Select your supervisor before sending the survey."); return; }
    if (await persist({ status: "submitted" })) toast.success("Survey sent");
  };
  const remove = async () => { if (!confirm(s.status === "draft" ? "Delete this draft survey? This cannot be undone." : `Delete this ${STATUS[s.status]?.toLowerCase() ?? ""} survey, including its pricing and photos list? This cannot be undone.`)) return; const r = await supabase.from("site_surveys").delete().eq("id", id); if (r.error) toast.error(r.error.message); else { void qc.invalidateQueries({ queryKey: ["site-surveys"] }); onBack(); } };

  return <div className="mx-auto max-w-4xl space-y-5">
    <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />All surveys</Button><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[s.status]}</span>{s.status === "draft" && surveyItemsPending(items(s.materials), items(s.other_items), details) && <span className="rounded-full border border-primary px-2 py-0.5 text-xs text-primary">Materials to complete</span>}{office && !editable && <Button className="ml-auto" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}><Trash2 className="mr-1 h-4 w-4" />Delete survey</Button>}</div>
    <fieldset disabled={!editable} className="min-w-0 space-y-4 border-b pb-5">
      <legend className="px-1 font-medium">Survey details</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <ClientSitePicker clientId={s.client_id} siteId={s.site_id} siteLabel="Site / Location" noneClientLabel="New client / enter on site" noneSiteLabel="New site / enter on site" onChange={(client_id, site_id) => set({ client_id, site_id })} />
        {!s.client_id && <div><Label htmlFor="sv-new-client">Client name</Label><Input id="sv-new-client" value={details.clientName} onChange={e => setDetails({ ...details, clientName: e.target.value })} /></div>}
        {!s.site_id && <><div><Label htmlFor="sv-new-site">Site name / door</Label><Input id="sv-new-site" value={details.siteName} onChange={e => setDetails({ ...details, siteName: e.target.value })} /></div><div><Label htmlFor="sv-new-address">Street / location</Label><Input id="sv-new-address" value={details.address} onChange={e => setDetails({ ...details, address: e.target.value })} /></div><div><Label htmlFor="sv-new-code">Branch / Store ID (optional)</Label><Input id="sv-new-code" value={details.storeCode} onChange={e => setDetails({ ...details, storeCode: e.target.value })} /></div></>}
        <div><Label htmlFor="sv-loc">Equipment / location reference</Label><Input id="sv-loc" placeholder="e.g. Lift 2, Plant room B" value={s.location_ref ?? ""} onChange={(e) => set({ location_ref: e.target.value })} /></div>
        <div><Label htmlFor="sv-purpose">Survey purpose</Label><select id="sv-purpose" className={sel} value={s.survey_purpose} onChange={(e) => set({ survey_purpose: e.target.value, track: office && e.target.value === "new_install" ? "supplier_rfq" : s.track })}>{PURPOSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      </div>
      <SurveyContacts details={details} onChange={setDetails} />
      <SurveyTrades details={details} companyTrades={company.data?.trades ?? []} onChange={setDetails} />
      {office && <fieldset className="space-y-1"><legend className="text-sm font-medium">How will this be priced?</legend>
        {([["direct", "Office prices directly from our price list (repairs, replacements)"], ["supplier_rfq", "Supplier quotes needed first (new installations, major equipment)"]] as const).map(([k, v]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="track" checked={s.track === k} onChange={() => set({ track: k })} />{v}</label>)}
      </fieldset>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="sv-access">Access & logistics</Label><SuggestedTextarea id="sv-access" disabled={!editable} value={s.access_notes ?? ""} suggestions={accessSuggestions} onValueChange={(v) => set({ access_notes: v })} /></div>
        <div className="space-y-2"><div><Label htmlFor="sv-window">Working window</Label><Input id="sv-window" placeholder="e.g. Weekdays after 18:00" value={s.working_window ?? ""} onChange={(e) => set({ working_window: e.target.value })} /></div>{editable && <div className="flex flex-wrap gap-1">{WORKING_WINDOWS.map(window => <Button key={window} type="button" size="sm" variant="outline" className="h-auto whitespace-normal py-1 text-xs" onClick={() => set({ working_window: window })}>{window}</Button>)}</div>}</div>
      </div>
      <fieldset><legend className="text-sm font-medium">Site hazards</legend><div className="mt-1 grid gap-1 sm:grid-cols-2">{HAZARDS.map((h) => <label key={h} className="flex items-center gap-2 text-sm"><Checkbox checked={s.hazards.includes(h)} onCheckedChange={(v) => set({ hazards: v ? [...s.hazards, h] : s.hazards.filter((x) => x !== h) })} />{h}</label>)}</div></fieldset>
      <SurveyObservations details={details} onChange={setDetails} disabled={!editable} companyId={profile.company_id} surveyId={id} />
      <div><Label htmlFor="sv-scope">Scope summary</Label><Textarea id="sv-scope" rows={4} value={s.scope_summary ?? ""} onChange={(e) => set({ scope_summary: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="sv-rec">Recommended action</Label><Input id="sv-rec" value={s.recommended_action ?? ""} onChange={(e) => set({ recommended_action: e.target.value })} /></div>
        <div><Label htmlFor="sv-hours">Estimated labour hours</Label><Input id="sv-hours" inputMode="decimal" value={s.labour_hours ?? ""} onChange={(e) => set({ labour_hours: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        <div><Label htmlFor="sv-techs">Technicians needed</Label><Input id="sv-techs" inputMode="numeric" value={s.technicians ?? ""} onChange={(e) => set({ technicians: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        <div><Label htmlFor="sv-urg">Urgency</Label><select id="sv-urg" className={sel} value={s.urgency} onChange={(e) => set({ urgency: e.target.value })}><option value="routine">Routine</option><option value="soon">Within 2 weeks</option><option value="urgent">Urgent</option></select></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={details.materialsNA === true} onCheckedChange={(v) => setDetails({ ...details, materialsNA: v === true })} />Not applicable — no materials or equipment needed</label>
      <p className="text-xs text-muted-foreground">No time on site? Save as draft and add the items later.</p>
      <ItemList label="Materials & equipment needed" trades={details.trades} value={items(s.materials)} onChange={(v) => set({ materials: v as unknown as Json })} />
      <ItemList label="Other materials / equipment" trades={details.trades} value={items(s.other_items)} onChange={(v) => set({ other_items: v as unknown as Json })} />
    </fieldset>
    {(editable || office) && <div className="flex flex-wrap items-end gap-2">
      <div className="w-72"><Label htmlFor="sv-rev">Reviewer</Label><select id="sv-rev" className={sel} value={reviewer ?? ""} onChange={(e) => office && s.status !== "draft" ? void persist({ reviewer_id: e.target.value || null }) : set({ reviewer_id: e.target.value || null })}><option value="">{office ? "Company default" : "Choose supervisor…"}</option>{reviewers.map((m) => <option key={m.id} value={m.id}>{m.name} · {roleLabel[m.role]}</option>)}</select></div>
      {editable && <><Button variant="outline" disabled={busy} onClick={() => void persist().then((ok) => ok && toast.success("Draft saved"))}>Save draft</Button><Button disabled={busy} onClick={() => void submit()}><Send className="mr-1 h-4 w-4" />Submit for review</Button><Button variant="ghost" disabled={busy} onClick={() => void remove()}><Trash2 className="mr-1 h-4 w-4" />Delete</Button></>}
    </div>}
    {office && <SurveyTradeReview details={details} review={(s.trade_review ?? {}) as unknown as TradeReview} onChange={value => set({ trade_review: value as unknown as Json })} />}
    {office && !editable && details.trades.length > 0 && <Button variant="outline" disabled={busy} onClick={() => void persist().then(ok => ok && toast.success("Trade handling saved"))}>Save trade handling</Button>}
    {office && s.status !== "draft" && <PriceGenerator survey={s} busy={busy} persist={persist} />}
  </div>;
}

function ItemList({ label, value, trades, onChange }: { label: string; value: Item[]; trades: string[]; onChange: (v: Item[]) => void }) {
  return <div className="space-y-2"><Label>{label}</Label>
    {[...new Set(["", ...trades, ...value.map(it => it.trade ?? "")])].map(trade => <div key={trade} className="space-y-2">{value.some(it => (it.trade ?? "") === trade) && <p className="text-xs font-medium text-muted-foreground">{trade ? surveyTradeLabel(trade) : "General"}</p>}{value.map((it, i) => (it.trade ?? "") !== trade ? null : <div key={i} className="grid grid-cols-[1fr_5rem_auto] gap-2 sm:grid-cols-[1fr_10rem_5rem_auto]"><Input aria-label={`${label} item ${i + 1}`} value={it.label} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /><select aria-label={`${label} trade ${i + 1}`} className={`${sel} col-span-3 row-start-2 sm:col-span-1 sm:row-auto`} value={it.trade ?? ""} onChange={e => onChange(value.map((x, j) => j === i ? { ...x, trade: e.target.value } : x))}><option value="">General</option>{trades.map(t => <option key={t} value={t}>{surveyTradeLabel(t)}</option>)}</select><Input aria-label={`${label} quantity ${i + 1}`} inputMode="decimal" value={it.qty} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) || 0 } : x))} /><Button type="button" size="icon" variant="ghost" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { label: "", qty: 1 }])}><Plus className="mr-1 h-4 w-4" />Add item</Button>
  </div>;
}

const F = ({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) => <label className={`min-w-0 space-y-1 ${className}`}><span className="block text-xs text-muted-foreground">{label}</span>{children}</label>;
const money = (v: number) => `€${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PriceGenerator({ survey, busy, persist }: { survey: Survey; busy: boolean; persist: (p: Partial<Survey>) => Promise<boolean> }) {
  const [p, setP] = useState<Pricing>(() => {
    const x = parsePricing(survey.pricing);
    if (!x.labour.length && survey.labour_hours) x.labour = [{ label: "Labour", people: survey.technicians ?? 1, hours: survey.labour_hours / Math.max(1, survey.technicians ?? 1), rate: 0 }];
    return x;
  });
  const [zoho, setZoho] = useState<boolean>(survey.zoho_sync ?? survey.track === "direct");
  const t = pricingTotals(p), client = clientEstimateView(p);
  const lines = (key: "base" | "logistics" | "site", title: string, rated = false) => <div className="space-y-2"><Label>{title}</Label>
    {p[key].map((l: PricingLine, i) => { const upd = (patch: Partial<PricingLine>) => setP({ ...p, [key]: p[key].map((x, j) => j === i ? { ...x, ...patch } : x) }); const unit = l.unit ?? "fixed"; return <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_8rem_6rem_7rem_auto]">
      <F label="Description" className="col-span-2 sm:col-span-1"><Input value={l.label} onChange={(e) => upd({ label: e.target.value })} /></F>
      {rated ? <F label="Charged"><select className={sel} value={unit} onChange={(e) => upd({ unit: e.target.value as RateUnit, qty: l.qty ?? 1 })}><option value="fixed">Fixed price</option><option value="hour">Per hour</option><option value="day">Per day</option></select></F> : <span className="hidden sm:block" />}
      {rated && unit !== "fixed" ? <F label={unit === "hour" ? "Hours" : "Days"}><Input inputMode="decimal" value={l.qty ?? 1} onChange={(e) => upd({ qty: Number(e.target.value) || 0 })} /></F> : <span className="hidden sm:block" />}
      <F label={unit === "hour" ? "Rate / hr (€)" : unit === "day" ? "Rate / day (€)" : "Amount (€)"}><Input inputMode="decimal" value={l.amount} onChange={(e) => upd({ amount: Number(e.target.value) || 0 })} /></F>
      <Button size="icon" variant="ghost" aria-label={`Remove ${title} ${i + 1}`} onClick={() => setP({ ...p, [key]: p[key].filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>; })}
    <Button size="sm" variant="outline" onClick={() => setP({ ...p, [key]: [...p[key], { label: "", amount: 0, ...(rated ? { unit: "day" as const, qty: 1 } : {}) }] })}><Plus className="mr-1 h-4 w-4" />Add</Button></div>;
  const save = (status?: string) => void persist({ pricing: p as unknown as Json, zoho_sync: zoho, ...(status ? { status } : survey.status === "submitted" ? { status: "under_review" } : {}) }).then((ok) => ok && toast.success("Pricing saved"));
  return <section className="min-w-0 space-y-4 border-b pb-5">
    <h2 className="font-semibold">Office price generator <span className="text-xs font-normal text-muted-foreground">(internal — never shown to the client)</span></h2>
    {survey.track === "supplier_rfq" && <p className="border-l-2 border-primary bg-muted p-2 text-sm">Enter the supplier's quoted price you selected under "Base cost". Supplier quotes stay internal and are never sent to clients or accounting.</p>}
    {lines("base", survey.track === "supplier_rfq" ? "Base cost (selected supplier quote)" : "Materials & parts cost")}
    {lines("logistics", "Freight, clearance & transport")}
    {lines("site", "Site logistics & equipment hire", true)}
    <div className="space-y-2"><Label>Labour</Label>
      {p.labour.map((l, i) => { const upd = (patch: Partial<Pricing["labour"][number]>) => setP({ ...p, labour: p.labour.map((x, j) => j === i ? { ...x, ...patch } : x) }); const unit = l.unit ?? "hour"; return <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_5rem_7rem_5rem_7rem_auto]">
        <F label="Role / task" className="col-span-2 sm:col-span-1"><Input value={l.label} onChange={(e) => upd({ label: e.target.value })} /></F>
        <F label="People"><Input inputMode="decimal" value={l.people} onChange={(e) => upd({ people: Number(e.target.value) || 0 })} /></F>
        <F label="Charged"><select className={sel} value={unit} onChange={(e) => upd({ unit: e.target.value as "hour" | "day" })}><option value="hour">Per hour</option><option value="day">Per day</option></select></F>
        <F label={unit === "day" ? "Days" : "Hours"}><Input inputMode="decimal" value={l.hours} onChange={(e) => upd({ hours: Number(e.target.value) || 0 })} /></F>
        <F label={unit === "day" ? "Rate / day (€)" : "Rate / hr (€)"}><Input inputMode="decimal" value={l.rate} onChange={(e) => upd({ rate: Number(e.target.value) || 0 })} /></F>
        <Button size="icon" variant="ghost" aria-label={`Remove labour ${i + 1}`} onClick={() => setP({ ...p, labour: p.labour.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>; })}
      <Button size="sm" variant="outline" onClick={() => setP({ ...p, labour: [...p.labour, { label: "", people: 1, hours: 1, rate: 0, unit: "hour" }] })}><Plus className="mr-1 h-4 w-4" />Add labour</Button></div>
    <div className="grid gap-3 sm:grid-cols-3">{([["contingencyPct", "Contingency %"], ["marginPct", "Target margin %"], ["vatPct", "VAT %"]] as const).map(([k, v]) => <div key={k}><Label htmlFor={`pg-${k}`}>{v}</Label><Input id={`pg-${k}`} inputMode="decimal" value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) || 0 })} /></div>)}</div>
    <dl className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-4"><dt className="text-muted-foreground">Internal cost</dt><dd>{money(t.cost)}</dd><dt className="text-muted-foreground">Profit</dt><dd>{money(t.profit)}</dd></dl>
    <div><Label htmlFor="pg-desc">Client-facing description</Label><Textarea id="pg-desc" rows={3} placeholder="Rewrite the scope in plain client language" value={p.clientDescription} onChange={(e) => setP({ ...p, clientDescription: e.target.value })} /></div>
    <div className="rounded-lg border p-3"><p className="text-sm font-medium">Client estimate preview</p><p className="whitespace-pre-wrap text-sm">{client.description || "—"}</p><p className="mt-2 text-sm">Total excl. VAT {money(client.net)} · VAT {client.vatPct}% {money(client.vat)} · <span className="font-semibold">Total {money(client.gross)}</span></p></div>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={zoho} onCheckedChange={(v) => setZoho(v === true)} />Send the client estimate to accounting (Zoho Books) as a draft</label>
    <div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => save()}>Save pricing</Button><Button disabled={busy} onClick={() => save("priced")}>Mark priced</Button><Button disabled={busy} variant="ghost" onClick={() => save("rejected")}>Reject survey</Button><Button asChild variant="link"><Link to="/estimates">Open estimates</Link></Button></div>
  </section>;
}
