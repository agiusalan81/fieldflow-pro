import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { formatMoney } from "@/lib/locale";
import { crmAllows, leadValueLabel, type CrmLevel, CRM_STAGES, DEAL_TYPES, LEAD_SOURCES, OPEN_STAGES, canConvert, defaultDue, followupState, isClosed, mergeActions, pipelineTotals, stageLabel, type WonTarget } from "@/lib/crm";
import { useCrmAccess } from "@/lib/crm-access";
import { useCompanyRules } from "@/lib/company";
import { PhoneInput } from "@/components/client-manager";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ClientSitePicker } from "@/components/client-site-picker";
import { VoiceDictation } from "@/components/voice-dictation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Lead = { id: string; title: string; client_id: string | null; site_id: string | null; contact_name: string; contact_phone: string; contact_email: string; deal_type: string; source: string; value: number | null; stage: string; owner_id: string | null; lost_reason: string | null; quote_id: string | null; job_id: string | null; created_at: string; clients: { name: string } | null };
type Followup = { id: string; opportunity_id: string; action_key: string; action_label: string; due_at: string; done_at: string | null; notes: string };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message) ?? "Something went wrong";
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const dealLabel = (k: string) => DEAL_TYPES.find((d) => d.key === k)?.label ?? k;

function useActionTypes(company?: string) {
  return useQuery({ queryKey: ["crm-action-types", company], enabled: !!company, queryFn: async () => {
    const r = await supabase.from("crm_action_types").select("id,label,icon,due_hours,archived").order("label"); if (r.error) throw r.error; return r.data;
  } });
}

export function CrmPipeline({ leadId, onOpenLead }: { leadId?: string | undefined; onOpenLead: (id: string | undefined) => void }) {
  const { data: profile } = useProfile();
  const company = profile?.company_id;
  const [view, setView] = useState("board"); const [stage, setStage] = useState("open"); const [query, setQuery] = useState(""); const [creating, setCreating] = useState(false);
  const level = useCrmAccess(!!profile).data ?? "none";
  const leads = useQuery({ queryKey: ["crm-leads", company], enabled: !!company, queryFn: async () => {
    const r = await supabase.from("crm_opportunities").select("id,title,client_id,site_id,contact_name,contact_phone,contact_email,deal_type,source,value,stage,owner_id,lost_reason,quote_id,job_id,created_at,clients(name)").order("updated_at", { ascending: false }).limit(500);
    if (r.error) throw r.error; return r.data as unknown as Lead[];
  } });
  const followups = useQuery({ queryKey: ["crm-followups", company], enabled: !!company, queryFn: async () => {
    const r = await supabase.from("crm_followups").select("id,opportunity_id,action_key,action_label,due_at,done_at,notes").is("done_at", null).order("due_at"); if (r.error) throw r.error; return r.data as Followup[];
  } });
  const nextFollowup = useMemo(() => { const m = new Map<string, Followup>(); for (const f of followups.data ?? []) if (!m.has(f.opportunity_id)) m.set(f.opportunity_id, f); return m; }, [followups.data]);
  const rows = (leads.data ?? []).filter((l) => (stage === "all" || (stage === "open" ? !isClosed(l.stage) : l.stage === stage)) && (!query.trim() || `${l.title} ${l.clients?.name ?? ""} ${l.contact_name}`.toLowerCase().includes(query.trim().toLowerCase())));
  const totals = pipelineTotals(leads.data ?? []);
  const lead = (leads.data ?? []).find((l) => l.id === leadId);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="board">Board</TabsTrigger><TabsTrigger value="list">List</TabsTrigger>{crmAllows(level, "manager") && <TabsTrigger value="types">Follow-up types</TabsTrigger>}</TabsList></Tabs>
      {crmAllows(level, "contributor") && <Button data-tour="crm-new-lead" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />New lead</Button>}
    </div>
    {view !== "types" && <div className="flex flex-wrap gap-2">
      <Input aria-label="Search leads" placeholder="Search leads, clients or contacts" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full sm:w-72" />
      <NativeSelect aria-label="Stage filter" className="w-full sm:w-48" value={stage} onValueChange={setStage}><option value="open">Open leads</option><option value="all">All stages</option>{CRM_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</NativeSelect>
    </div>}
    {leads.isLoading ? <p className="text-sm text-muted-foreground">Loading leads…</p> : view === "types" ? <ActionTypesEditor company={company} /> : view === "board" ? (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {CRM_STAGES.filter((s) => stage === "all" || (stage === "open" ? OPEN_STAGES.includes(s.key) : s.key === stage)).map((s) => <section key={s.key} className="w-72 shrink-0 space-y-2 rounded-lg border bg-muted/40 p-2" aria-label={s.label}>
          <header className="flex items-center justify-between px-1 text-sm font-medium"><span>{s.label} <span className="text-muted-foreground">{totals[s.key].count}</span></span><span className="text-xs text-muted-foreground">{formatMoney(totals[s.key].value)}</span></header>
          {rows.filter((l) => l.stage === s.key).map((l) => <LeadCard key={l.id} lead={l} next={nextFollowup.get(l.id)} onOpen={() => onOpenLead(l.id)} />)}
        </section>)}
      </div>
    ) : <div className="divide-y rounded-lg border">{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No leads yet.</p> : rows.map((l) => <button key={l.id} type="button" onClick={() => onOpenLead(l.id)} className="flex w-full flex-wrap items-center gap-3 p-3 text-left hover:bg-muted/50">
      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{l.title}</span><span className="block truncate text-xs text-muted-foreground">{l.clients?.name ?? (l.contact_name || "No client yet")} · {dealLabel(l.deal_type)}</span></span>
      <Badge variant="outline">{stageLabel(l.stage)}</Badge><FollowupChip f={nextFollowup.get(l.id)} /><span className="text-sm">{leadValueLabel(l.value, formatMoney)}</span>
    </button>)}</div>}
    <NewLeadDialog open={creating} onOpenChange={setCreating} company={company} onCreated={(id) => onOpenLead(id)} />
    <Sheet open={!!leadId} onOpenChange={(o) => { if (!o) onOpenLead(undefined); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">{lead ? <LeadPanel lead={lead} company={company} level={level} onDeleted={() => onOpenLead(undefined)} /> : <SheetHeader><SheetTitle>{leads.isLoading ? "Loading…" : "Lead not found"}</SheetTitle></SheetHeader>}</SheetContent>
    </Sheet>
  </div>;
}

function FollowupChip({ f }: { f?: Followup | undefined }) {
  if (!f) return null;
  const s = followupState(f);
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${s === "overdue" ? "bg-destructive text-destructive-foreground" : s === "due_today" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}><Clock className="h-3 w-3" />{f.action_label} · {new Date(f.due_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>;
}

function LeadCard({ lead, next, onOpen }: { lead: Lead; next?: Followup | undefined; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="w-full space-y-1 rounded-md border bg-card p-3 text-left text-sm shadow-sm hover:border-primary">
    <span className="block font-medium">{lead.title}</span>
    <span className="block text-xs text-muted-foreground">{lead.clients?.name ?? (lead.contact_name || "No client yet")} · {dealLabel(lead.deal_type)}</span>
    <span className="block text-xs">{leadValueLabel(lead.value, formatMoney)}</span>
    <FollowupChip f={next} />
  </button>;
}

export function NewLeadDialog({ open, onOpenChange, company, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; company?: string | undefined; onCreated: (id: string) => void }) {
  const qc = useQueryClient(); const types = useActionTypes(company); const actions = mergeActions(types.data ?? []);
  const blank = { title: "", client_id: null as string | null, site_id: null as string | null, contact_name: "", contact_phone: "", contact_email: "", deal_type: "repair", source: "phone", value: "", valueUnknown: true, phoneCode: "", note: "", action: "default:phone_call", due: toLocalInput(defaultDue(actions[0] ?? { dueHours: 24 })) };
  const [f, setF] = useState(blank); const [busy, setBusy] = useState(false);
  const defaultCode = useCompanyRules().data?.locale.countryCode ?? "+356";
  const phoneCode = f.phoneCode || defaultCode;
  const set = (p: Partial<typeof blank>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.title.trim()) { toast.error("Give the lead a short title"); return; }
    const a = actions.find((x) => x.key === f.action);
    setBusy(true);
    const r = await supabase.rpc("crm_create_lead", { _lead: { title: f.title, client_id: f.client_id, site_id: f.site_id, contact_name: f.contact_name, contact_phone: f.contact_phone.trim() ? `${phoneCode} ${f.contact_phone.trim()}` : "", contact_email: f.contact_email, deal_type: f.deal_type, source: f.source, value: !f.valueUnknown && f.value.trim() ? f.value.replace(",", ".") : null }, _note: f.note, _followup: a && f.due ? { action_key: a.key, action_label: a.label, due_at: new Date(f.due).toISOString() } : null });
    setBusy(false);
    if (r.error) { toast.error(errMsg(r.error)); return; }
    toast.success("Lead saved"); setF(blank); onOpenChange(false);
    await qc.invalidateQueries({ queryKey: ["crm-leads"] }); await qc.invalidateQueries({ queryKey: ["crm-followups"] });
    onCreated(r.data as string);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
    <div className="space-y-4">
      <div className="space-y-1"><Label htmlFor="lead-title">What do they need?</Label><Input id="lead-title" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Lift door keeps reopening" /></div>
      <ClientSitePicker clientId={f.client_id} siteId={f.site_id} onChange={(c, s) => set({ client_id: c, site_id: s })} noneClientLabel="Not a client yet" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="lead-contact">Caller name</Label><Input id="lead-contact" value={f.contact_name} onChange={(e) => set({ contact_name: e.target.value })} /></div>
        <div className="space-y-1"><Label>Phone</Label><PhoneInput code={phoneCode} number={f.contact_phone} onChange={(c, n) => set({ phoneCode: c, contact_phone: n })} /></div>
        <div className="space-y-1"><Label htmlFor="lead-email">Email</Label><Input id="lead-email" type="email" value={f.contact_email} onChange={(e) => set({ contact_email: e.target.value })} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="lead-type">Deal type</Label><NativeSelect id="lead-type" value={f.deal_type} onValueChange={(v) => set({ deal_type: v })}>{DEAL_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</NativeSelect></div>
        <div className="space-y-1"><Label htmlFor="lead-source">Source</Label><NativeSelect id="lead-source" value={f.source} onValueChange={(v) => set({ source: v })}>{LEAD_SOURCES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</NativeSelect></div>
        <div className="space-y-1"><Label htmlFor="lead-value">Estimated value</Label><Input id="lead-value" inputMode="decimal" disabled={f.valueUnknown} placeholder={f.valueUnknown ? "Unknown for now" : "0.00"} value={f.valueUnknown ? "" : f.value} onChange={(e) => set({ value: e.target.value })} /><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-4 w-4 accent-primary" checked={f.valueUnknown} onChange={(e) => set({ valueUnknown: e.target.checked })} />Unknown — add after site visit</label></div>
      </div>
      <div className="space-y-1"><div className="flex items-center justify-between gap-2"><Label htmlFor="lead-note">Call notes</Label><VoiceDictation label="Dictate call notes" value={f.note} onApply={(t) => set({ note: t })} /></div><Textarea id="lead-note" rows={4} value={f.note} onChange={(e) => set({ note: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="lead-action">First follow-up</Label><NativeSelect id="lead-action" value={f.action} onValueChange={(v) => { const a = actions.find((x) => x.key === v); set({ action: v, ...(a ? { due: toLocalInput(defaultDue(a)) } : {}) }); }}><option value="">No follow-up</option>{actions.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</NativeSelect></div>
        {f.action && <div className="space-y-1"><Label htmlFor="lead-due">Due</Label><Input id="lead-due" type="datetime-local" value={f.due} onChange={(e) => set({ due: e.target.value })} /></div>}
      </div>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save lead"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function LeadPanel({ lead, company, level, onDeleted }: { lead: Lead; company?: string | undefined; level: CrmLevel; onDeleted: () => void }) {
  const canEdit = crmAllows(level, "contributor"), canClose = crmAllows(level, "closer"), canDelete = crmAllows(level, "manager");
  const qc = useQueryClient(); const navigate = useNavigate(); const types = useActionTypes(company); const actions = mergeActions(types.data ?? []);
  const [note, setNote] = useState(""); const [kind, setKind] = useState("note"); const [action, setAction] = useState("default:phone_call"); const [due, setDue] = useState(toLocalInput(defaultDue({ dueHours: 24 })));
  const [won, setWon] = useState<WonTarget>("quote"); const [lostReason, setLostReason] = useState(""); const [recontact, setRecontact] = useState(""); const [busy, setBusy] = useState(false);
  const timeline = useQuery({ queryKey: ["crm-activities", lead.id], queryFn: async () => { const r = await supabase.from("crm_activities").select("id,kind,body,created_at").eq("opportunity_id", lead.id).order("created_at", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  const fups = useQuery({ queryKey: ["crm-lead-followups", lead.id], queryFn: async () => { const r = await supabase.from("crm_followups").select("id,opportunity_id,action_key,action_label,due_at,done_at,notes").eq("opportunity_id", lead.id).order("due_at", { ascending: false }); if (r.error) throw r.error; return r.data as Followup[]; } });
  const refresh = () => Promise.all(["crm-leads", "crm-followups", "action-notifications"].map((k) => qc.invalidateQueries({ queryKey: [k] })).concat([qc.invalidateQueries({ queryKey: ["crm-activities", lead.id] }), qc.invalidateQueries({ queryKey: ["crm-lead-followups", lead.id] })]));
  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => { setBusy(true); const r = await fn(); setBusy(false); if (r.error) { toast.error(errMsg(r.error)); return false; } toast.success(ok); await refresh(); return true; };
  const closed = isClosed(lead.stage);
  const [valueText, setValueText] = useState(lead.value == null ? "" : String(lead.value));
  const saveValue = () => { const t = valueText.trim().replace(",", "."); const v = t ? Number(t) : null; if (v != null && !Number.isFinite(v)) { toast.error("Enter a number or leave empty for TBD"); return; } void run(() => supabase.from("crm_opportunities").update({ value: v }).eq("id", lead.id), "Value updated"); };
  const del = async () => { setBusy(true); const r = await supabase.rpc("crm_delete_lead", { _id: lead.id }); setBusy(false); if (r.error) { toast.error(errMsg(r.error)); return; } toast.success("Lead deleted"); onDeleted(); await Promise.all(["crm-leads", "crm-followups", "action-notifications"].map((k) => qc.invalidateQueries({ queryKey: [k] }))); };
  const markWon = async () => {
    setBusy(true); const r = await supabase.rpc("crm_mark_won", { _id: lead.id, _target: won }); setBusy(false);
    if (r.error) { toast.error(errMsg(r.error)); return; }
    await refresh(); toast.success("Lead won");
    const out = r.data as { quote_id?: string; job_id?: string };
    if (won === "quote" && out.quote_id) navigate({ to: "/estimates", search: { quote: out.quote_id } });
    else if (won === "job") navigate({ to: "/admin/jobs" });
    else if (won === "contract") navigate({ to: "/contracts" });
  };
  return <div className="space-y-5">
    <SheetHeader><SheetTitle>{lead.title}</SheetTitle></SheetHeader>
    <div className="flex flex-wrap gap-2 text-sm"><Badge>{stageLabel(lead.stage)}</Badge><Badge variant="outline">{dealLabel(lead.deal_type)}</Badge><Badge variant="outline">{LEAD_SOURCES.find((s) => s.key === lead.source)?.label ?? lead.source}</Badge><Badge variant="outline">{leadValueLabel(lead.value, formatMoney)}</Badge></div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm"><dt className="text-muted-foreground">Client</dt><dd>{lead.clients?.name ?? "Not a client yet"}</dd><dt className="text-muted-foreground">Contact</dt><dd>{[lead.contact_name, lead.contact_phone, lead.contact_email].filter(Boolean).join(" · ") || "—"}</dd>{lead.lost_reason && <><dt className="text-muted-foreground">Lost reason</dt><dd>{lead.lost_reason}</dd></>}</dl>
    <div className="flex flex-wrap gap-2">
      {lead.quote_id && <Button size="sm" variant="outline" onClick={() => navigate({ to: "/estimates", search: { quote: lead.quote_id ?? undefined } })}>Open estimate</Button>}
      {lead.job_id && <Button size="sm" variant="outline" onClick={() => navigate({ to: "/admin/jobs" })}>Open dispatch</Button>}
    </div>
    {canEdit && <div className="flex items-end gap-2"><div className="flex-1 space-y-1"><Label htmlFor="lead-value-edit">Estimated value</Label><Input id="lead-value-edit" inputMode="decimal" placeholder="TBD" value={valueText} onChange={(e) => setValueText(e.target.value)} /></div><Button size="sm" variant="outline" disabled={busy} onClick={saveValue}>Save value</Button></div>}
    {!closed && canClose && <div className="space-y-1"><Label htmlFor="lead-stage">Stage</Label><NativeSelect id="lead-stage" value={lead.stage} disabled={busy} onValueChange={(v) => void run(() => supabase.from("crm_opportunities").update({ stage: v }).eq("id", lead.id), "Stage updated")}>{OPEN_STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}</NativeSelect></div>}

    <section className="space-y-2" aria-label="Follow-ups"><h3 className="font-medium">Follow-ups</h3>
      {(fups.data ?? []).map((f) => <div key={f.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><span className="min-w-0 flex-1"><FollowupChip f={f.done_at ? undefined : f} />{f.done_at && <span className="text-muted-foreground line-through">{f.action_label} · {new Date(f.due_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>}</span>{!f.done_at && canEdit && <Button size="sm" variant="ghost" aria-label={`Mark ${f.action_label} done`} disabled={busy} onClick={() => void run(() => supabase.from("crm_followups").update({ done_at: new Date().toISOString() }).eq("id", f.id), "Follow-up done")}><CheckCircle2 className="h-4 w-4" /></Button>}</div>)}
      {!closed && canEdit && <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><NativeSelect aria-label="Follow-up action" value={action} onValueChange={(v) => { setAction(v); const a = actions.find((x) => x.key === v); if (a) setDue(toLocalInput(defaultDue(a))); }}>{actions.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</NativeSelect><Input aria-label="Follow-up due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /><Button disabled={busy || !due} onClick={() => { const a = actions.find((x) => x.key === action); if (a) void run(() => supabase.from("crm_followups").insert({ opportunity_id: lead.id, action_key: a.key, action_label: a.label, due_at: new Date(due).toISOString() }), "Follow-up scheduled"); }}>Add</Button></div>}
      <p className="text-xs text-muted-foreground">Follow-ups are reminders only — nothing is sent to the client automatically.</p>
    </section>

    <section className="space-y-2" aria-label="Timeline"><div className="flex items-center justify-between gap-2"><h3 className="font-medium">Timeline</h3>{canEdit && <VoiceDictation label="Dictate a note" value={note} onApply={setNote} />}</div>
      {canEdit && <><div className="grid gap-2 sm:grid-cols-[10rem_1fr]"><NativeSelect aria-label="Entry type" value={kind} onValueChange={setKind}><option value="note">Note</option><option value="call">Phone call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="meeting">Meeting</option></NativeSelect><Textarea aria-label="Timeline entry" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <Button size="sm" disabled={busy || !note.trim()} onClick={async () => { if (await run(() => supabase.from("crm_activities").insert({ opportunity_id: lead.id, kind, body: note.trim() }), "Added to timeline")) setNote(""); }}>Add to timeline</Button></>}
      <ol className="space-y-2">{(timeline.data ?? []).map((a) => <li key={a.id} className="rounded-md border p-2 text-sm"><div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {a.kind}</div><p className="whitespace-pre-wrap">{a.body}</p></li>)}</ol>
    </section>

    {!closed && canClose && <section className="grid gap-4 rounded-lg border p-3 sm:grid-cols-2" aria-label="Close lead">
      <div className="space-y-2"><h3 className="font-medium">Mark as won</h3><NativeSelect aria-label="Convert to" value={won} onValueChange={(v) => setWon(v as WonTarget)}><option value="quote" disabled={!canConvert("quote", lead)}>Create customer estimate</option><option value="job" disabled={!canConvert("job", lead)}>Create dispatch job{lead.client_id ? "" : " (needs a client)"}</option><option value="contract">Set up a contract</option><option value="none">Just mark won</option></NativeSelect><Button className="w-full" disabled={busy || !canConvert(won, lead)} onClick={markWon}>Mark won</Button></div>
      <div className="space-y-2"><h3 className="font-medium">Mark as lost</h3><Input aria-label="Lost reason" placeholder="Reason (required)" value={lostReason} onChange={(e) => setLostReason(e.target.value)} /><Label htmlFor="recontact" className="text-xs text-muted-foreground">Remind me to re-contact (optional)</Label><Input id="recontact" type="date" value={recontact} onChange={(e) => setRecontact(e.target.value)} /><Button variant="outline" className="w-full" disabled={busy || !lostReason.trim()} onClick={() => void run(() => supabase.rpc("crm_mark_lost", { _id: lead.id, _reason: lostReason, ...(recontact ? { _recontact_at: new Date(`${recontact}T09:00`).toISOString() } : {}) }), "Lead marked lost")}>Mark lost</Button></div>
    </section>}
    {closed && canClose && <Button variant="outline" disabled={busy} onClick={() => void run(() => supabase.from("crm_opportunities").update({ stage: "contacted" }).eq("id", lead.id), "Lead reopened")}>Reopen lead</Button>}
    {canDelete && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="w-full text-destructive" disabled={busy}><Trash2 className="mr-2 h-4 w-4" />Delete lead permanently</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this lead?</AlertDialogTitle><AlertDialogDescription>The lead, its timeline and follow-ups are removed for good. Any estimate or job already created from it stays.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => void del()}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
  </div>;
}

function ActionTypesEditor({ company }: { company?: string | undefined }) {
  const qc = useQueryClient(); const types = useActionTypes(company);
  const [label, setLabel] = useState(""); const [hours, setHours] = useState("24"); const [busy, setBusy] = useState(false);
  const all = mergeActions(types.data ?? []);
  const add = async () => {
    const h = Math.round(Number(hours)); if (!label.trim() || !Number.isFinite(h) || h < 0) { toast.error("Enter a name and a due time in hours"); return; }
    setBusy(true); const r = await supabase.from("crm_action_types").insert({ label: label.trim(), due_hours: h }); setBusy(false);
    if (r.error) { toast.error(errMsg(r.error)); return; } setLabel(""); await qc.invalidateQueries({ queryKey: ["crm-action-types"] });
  };
  const archive = async (id: string) => { const r = await supabase.from("crm_action_types").update({ archived: true }).eq("id", id); if (r.error) { toast.error(errMsg(r.error)); return; } await qc.invalidateQueries({ queryKey: ["crm-action-types"] }); };
  return <div className="max-w-xl space-y-3">
    <p className="text-sm text-muted-foreground">Built-in actions are always available. Add your own with a default due time.</p>
    <ul className="divide-y rounded-lg border">{all.map((a) => <li key={a.key} className="flex items-center gap-2 p-2 text-sm"><span className="flex-1">{a.label}</span><span className="text-muted-foreground">due in {a.dueHours} h</span>{a.custom ? <Button size="icon" variant="ghost" aria-label={`Remove ${a.label}`} onClick={() => void archive(a.key.slice(7))}><Trash2 className="h-4 w-4" /></Button> : <Badge variant="outline">Default</Badge>}</li>)}</ul>
    <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]"><Input aria-label="New follow-up type" placeholder="e.g. Send brochure" value={label} onChange={(e) => setLabel(e.target.value)} /><Input aria-label="Default due in hours" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} /><Button onClick={add} disabled={busy}>Add type</Button></div>
  </div>;
}
