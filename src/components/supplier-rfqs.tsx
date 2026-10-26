import { useNavigate } from "@tanstack/react-router";
import { parseIntegrations, ACCOUNTING } from "@/lib/integrations";
import { parsePhotos } from "@/lib/jobsheets";
import { estimateExportCsv } from "@/lib/estimate-export";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Copy, FileOutput, ImagePlus, Mail, PencilRuler, Phone, Pause, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useProfile } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { SketchPad } from "@/components/sketch-pad";
import { useEstimateConfig } from "@/components/estimate-settings";
import { RFQ_SECTIONS, alignToSupplier, mailto, optionsFor, reminderBody, reminderDue, rfqBody, rfqSubject, suggestedPersons, suppliersOffering, type EstimateConfig } from "@/lib/lift-rfq";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommercialRecipients } from '@/components/commercial-recipients';

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent to supplier" },
  { key: "quoted", label: "Estimate received" },
  { key: "client_ready", label: "Client estimate ready" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];
type Ev = { at: string; status: string; by: string };
type Contact = { name?: string; role?: string; phone?: string; email?: string; access?: string };
type Accounting = { provider: string; ref: string; exported_at: string };
type Rfq = { values?: Record<string, string>; contact?: Contact; notes?: string; source_sheet?: string | null; accounting?: Accounting | null };
type Form = { id: string; isNew: boolean; title: string; client_id: string; site_id: string; supplier_name: string; supplier_email: string; values: Record<string, string>; contact: Contact; notes: string; sketch: string | null; photos: string[]; source_sheet: string | null; accounting: Accounting | null };
const ROLES = ["Site agent / contractor", "Architect", "Building administrator / owner", "Facility manager", "Electrical / civil subcontractor"];

export function SupplierRfqs() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const { data: cfg } = useEstimateConfig(profile?.company_id);
  const { data = [] } = useQuery({
    queryKey: ["estimates"],
    queryFn: async () => { const { data, error } = await supabase.from("lift_estimates").select("*, clients(name), sites(name)").order("updated_at", { ascending: false }); if (error) throw error; return data; },
  });
  const [form, setForm] = useState<Form | null>(null);
  const fromSheet: string | undefined = undefined;
  const navigate = useNavigate();
  const { data: integ } = useQuery({ queryKey: ["integrations-accounting", profile?.company_id], enabled: !!profile, queryFn: async () => parseIntegrations((await supabase.from("company_settings").select("integrations").maybeSingle()).data?.integrations).accounting });
  const provider = ACCOUNTING.find((a) => a.key === integ?.provider);
  // Pending Works hands over one job sheet: prefill a new estimate from it, then clear the link so a refresh never duplicates it.
  useEffect(() => {
    if (!fromSheet || !cfg) return;
    let active = true;
    void (async () => {
      const { data: sh, error } = await supabase.from("job_sheets").select("id, jobsheet_number, client_id, site_id, pending_works_future_jobs, reported_fault, photo_paths, assets(reference_number)").eq("id", fromSheet).maybeSingle();
      if (!active) return;
      void navigate({ to: "/lift-rfq", replace: true });
      if (error || !sh) { toast.error("Could not load that job sheet for the estimate"); return; }
      const pending = (sh.pending_works_future_jobs ?? "").trim();
      const ref = sh.assets?.reference_number;
      setForm({ id: crypto.randomUUID(), isNew: true, title: `${pending.split("\n")[0]!.slice(0, 120) || "Follow-up repair"}${ref ? ` — ${ref}` : ""}`, client_id: sh.client_id ?? "none", site_id: sh.site_id ?? "none", supplier_name: "", supplier_email: "", values: { ...(cfg.defaults ?? {}), ...(ref ? { lift_ref: ref } : {}) }, contact: {}, notes: [pending, sh.reported_fault ? `Reported fault: ${sh.reported_fault}` : "", `From job sheet #${sh.jobsheet_number}`].filter(Boolean).join("\n\n"), sketch: null, photos: parsePhotos(sh.photo_paths).filter((p) => p.scope === "pending").map((p) => p.path), source_sheet: sh.id, accounting: null });
    })();
    return () => { active = false; };
  }, [fromSheet, cfg, navigate]);
  const exportToAccounts = async (e: (typeof data)[number]) => {
    if (!provider) return;
    const csv = estimateExportCsv({ title: e.title, client: e.clients?.name ?? "", site: e.sites?.name ?? "", notes: rfqOf(e).notes ?? e.specs ?? "", price: e.client_price == null ? null : Number(e.client_price), fixedLabour: e.fixed_labor, taxRate: integ?.tax_rate ?? "", incomeAccount: integ?.income_account ?? "" });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = `Estimate-${e.title.replace(/\W+/g, "_").slice(0, 40)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    const ref = window.prompt(`Estimate file prepared for ${provider.label}. Import it there, then enter the ${provider.label} estimate number to link it (optional):`, rfqOf(e).accounting?.ref ?? "");
    if (ref === null) return;
    if (await update(e, { rfq: { ...rfqOf(e), accounting: { provider: provider.key, ref: ref.trim(), exported_at: new Date().toISOString() } } as unknown as Json, events: log(e, `exported to ${provider.label}`) })) toast.success(ref.trim() ? `Linked to ${provider.label} estimate ${ref.trim()}` : `Marked as exported to ${provider.label}`);
  };
  const company = profile?.companies?.name ?? "";
  const sender = profile?.full_name ?? "";
  type E = (typeof data)[number];

  const log = (e: E, status: string) => [...((e.events as Ev[]) ?? []), { at: new Date().toISOString(), status, by: sender }];
  const update = async (e: E, patch: Database["public"]["Tables"]["lift_estimates"]["Update"]) => {
    const { error } = await supabase.from("lift_estimates").update(patch).eq("id", e.id);
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["estimates"] }); return true;
  };
  const move = (e: E, status: string, extra: Parameters<typeof update>[1] = {}) => update(e, { status, events: log(e, status), ...extra });
  const rfqOf = (e: E) => (e.rfq ?? {}) as Rfq;
  const subjectOf = (e: E) => rfqSubject(rfqOf(e).values?.["lift_ref"] ?? "", e.title, company);

  const sendToSupplier = async (e: E) => {
    if (!e.supplier_email) { toast.error("Add the supplier's email first (Edit)"); return; }
    const r = rfqOf(e);
    window.location.href = mailto(e.supplier_email, subjectOf(e), rfqBody({ title: e.title, values: r.values ?? {}, contact: r.contact as Record<string, string>, site: e.sites?.name ?? e.clients?.name ?? undefined, company, sender, notes: r.notes }));
    if (e.status === "draft") await move(e, "sent", { sent_at: new Date().toISOString(), reminders_sent: 0, last_reminder_at: null });
  };
  const sendReminder = async (e: E) => {
    if (!e.supplier_email || !e.sent_at) return;
    window.location.href = mailto(e.supplier_email, `Re: ${subjectOf(e)}`, reminderBody({ subject: subjectOf(e), sentAt: e.sent_at, sender, company }));
    await update(e, { reminders_sent: e.reminders_sent + 1, last_reminder_at: new Date().toISOString(), events: log(e, `reminder ${e.reminders_sent + 1}`) });
  };

  const openNew = () => setForm({ id: crypto.randomUUID(), isNew: true, title: "", client_id: "none", site_id: "none", supplier_name: "", supplier_email: "", values: { ...(cfg?.defaults ?? {}) }, contact: {}, notes: "", sketch: null, photos: [], source_sheet: null, accounting: null });
  const openEdit = (e: E) => { const r = rfqOf(e); setForm({ id: e.id, isNew: false, title: e.title, client_id: e.client_id ?? "none", site_id: e.site_id ?? "none", supplier_name: e.supplier_name ?? "", supplier_email: e.supplier_email ?? "", values: r.values ?? {}, contact: r.contact ?? {}, notes: r.notes ?? e.specs ?? "", sketch: e.sketch, photos: e.photos ?? [], source_sheet: r.source_sheet ?? null, accounting: r.accounting ?? null }); };

  const now = Date.now();
  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4">
        <Button className="h-11 w-full sm:w-auto" onClick={openNew}>New supplier RFQ</Button>
        {!data.length ? <EmptyState>No estimates yet.</EmptyState> : data.map((e) => {
          const idx = STEPS.findIndex((s) => s.key === e.status);
          const next = STEPS[idx + 1];
          const due = cfg ? reminderDue(e, cfg, now) : null;
          return (
            <article key={e.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-medium text-foreground">{e.title}</p><p className="text-sm text-muted-foreground">{e.sites?.name ?? e.clients?.name ?? "No client"} · {e.supplier_name ?? "No supplier"}{e.quoted_amount ? ` · €${Number(e.quoted_amount).toFixed(2)}` : ""}</p></div>
                <div className="flex flex-wrap gap-1">
                  {due === "due" && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">Reminder due</span>}
                  {due === "call" && <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">Needs a phone call</span>}
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">{STEPS[idx]?.label ?? e.status}</span>
                </div>
              </div>
              {e.sketch && <img src={e.sketch} alt="Layout sketch" className="h-28 rounded border bg-background object-contain" />}
              <ol className="space-y-1 border-l pl-3 text-xs text-muted-foreground">
                {((e.events as Ev[]) ?? []).map((ev, i) => <li key={i}>{new Date(ev.at).toLocaleString()} — {STEPS.find((s) => s.key === ev.status)?.label ?? ev.status} · {ev.by}</li>)}
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                {provider && e.client_price != null && <Button size="sm" variant="outline" onClick={() => exportToAccounts(e)}><FileOutput className="mr-1 h-4 w-4" />{rfqOf(e).accounting ? `${provider.label} · ${rfqOf(e).accounting?.ref || "exported"}` : `Send to ${provider.label}`}</Button>}
                {e.status==='client_ready'&&<CommercialRecipients clientId={e.client_id} siteId={e.site_id} purpose="estimate" title={e.title} body={`Estimate: ${e.title}${e.client_price?`\nClient price: €${Number(e.client_price).toFixed(2)}`:''}`}/>}
                {(e.status === "draft" || e.status === "sent") && <Button size="sm" onClick={() => sendToSupplier(e)}><Mail className="mr-1 h-4 w-4" />{e.status === "draft" ? "Send to supplier" : "Resend request"}</Button>}
                {due === "due" && <Button size="sm" onClick={() => sendReminder(e)}>Send reminder</Button>}
                {due === "call" && e.supplier_name && <Button size="sm" variant="outline" disabled><Phone className="mr-1 h-4 w-4" />Call {e.supplier_name}</Button>}
                {e.status === "sent" && <Button size="sm" variant="outline" onClick={() => update(e, { reminders_paused: !e.reminders_paused })}>{e.reminders_paused ? <><Play className="mr-1 h-4 w-4" />Resume reminders</> : <><Pause className="mr-1 h-4 w-4" />Pause reminders</>}</Button>}
                <Button size="sm" variant="outline" onClick={async () => { const r = rfqOf(e); await navigator.clipboard.writeText(rfqBody({ title: e.title, values: r.values ?? {}, contact: r.contact as Record<string, string>, company, sender, notes: r.notes })); toast.success("Estimate request copied"); }}><Copy className="mr-1 h-4 w-4" />Copy</Button>
                {next && e.status !== "won" && e.status !== "lost" && next.key !== "lost" && e.status !== "draft" && (
                  next.key === "quoted"
                    ? <Button size="sm" onClick={() => { const v = window.prompt("Supplier estimate amount (€)"); if (v) move(e, "quoted", { quoted_amount: Number(v) || null }); }}>Mark estimate received</Button>
                    : <Button size="sm" onClick={() => move(e, next.key)}>Mark: {next.label}</Button>
                )}
                {e.status === "client_ready" && <Button size="sm" variant="outline" onClick={() => move(e, "lost")}>Mark lost</Button>}
                <Button size="sm" variant="outline" onClick={async () => {
                  const v = window.prompt("Agreed client price (€) — used for billing", String(e.client_price ?? ""));
                  if (v === null) return;
                  const fixed = window.confirm("Does this price include labour? OK = fixed price (labour included), Cancel = labour billed from job sheet hours");
                  if (await update(e, { client_price: Number(v) || null, fixed_labor: fixed })) toast.success("Client price saved");
                }}>{e.client_price ? `Client price €${Number(e.client_price).toFixed(2)}${e.fixed_labor ? " · labour incl." : ""}` : "Set client price"}</Button>
              </div>
            </article>
          );
        })}
      </div>
      {form && cfg && profile && <EstimateForm form={form} setForm={setForm} cfg={cfg} companyId={profile.company_id} sender={sender} onSaved={() => { setForm(null); qc.invalidateQueries({ queryKey: ["estimates"] }); }} />}
    </>
  );
}

function EstimateForm({ form, setForm, cfg, companyId, sender, onSaved }: { form: Form; setForm: (f: Form | null) => void; cfg: EstimateConfig; companyId: string; sender: string; onSaved: () => void }) {
  const [sketching, setSketching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const { data: clients = [] } = useQuery({ queryKey: ["clients-min"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const { data: sites = [] } = useQuery({ queryKey: ["sites-min"], queryFn: async () => (await supabase.from("sites").select("id, name, client_id").order("name")).data ?? [] });
  const f = form; const set = (n: Partial<Form>) => setForm({ ...f, ...n });
  const setVal = (k: string, v: string) => set({ values: { ...f.values, [k]: v } });
  const supplier = cfg.suppliers.find((s) => s.name === f.supplier_name);

  useEffect(() => {
    const missing = f.photos.filter((p) => !urls[p]); if (!missing.length) return;
    supabase.storage.from("job-photos").createSignedUrls(missing, 3600).then(({ data }) => { if (data) setUrls((u) => ({ ...u, ...Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string])) })); });
  }, [f.photos, urls]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true); const added: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${companyId}/estimates/${f.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("job-photos").upload(path, file, { contentType: file.type });
      if (error) toast.error(error.message); else added.push(path);
    }
    setBusy(false); set({ photos: [...f.photos, ...added] });
  };

  const save = async () => {
    if (!f.title.trim()) { toast.error("Give the estimate a title"); return; }
    setBusy(true);
    const row = { title: f.title.trim(), client_id: f.client_id === "none" ? null : f.client_id, site_id: f.site_id === "none" ? null : f.site_id, supplier_name: f.supplier_name || null, supplier_email: f.supplier_email || null, rfq: { values: f.values, contact: f.contact, notes: f.notes, source_sheet: f.source_sheet, accounting: f.accounting } as unknown as Json, specs: f.notes, sketch: f.sketch, photos: f.photos };
    const { error } = f.isNew
      ? await supabase.from("lift_estimates").insert({ ...row, id: f.id, company_id: companyId, events: [{ at: new Date().toISOString(), status: "draft", by: sender }] })
      : await supabase.from("lift_estimates").update(row).eq("id", f.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Estimate saved"); onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.isNew ? "New estimate" : "Edit estimate"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Title</Label><Input className="h-11" placeholder="e.g. 8-person MRL lift, 5 stops" value={f.title} onChange={(e) => set({ title: e.target.value })} /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Client</Label><Select value={f.client_id} onValueChange={(v) => set({ client_id: v, site_id: "none" })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No client yet</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Site</Label><Select value={f.site_id} onValueChange={(v) => set({ site_id: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No site yet</SelectItem>{sites.filter((s) => f.client_id === "none" || s.client_id === f.client_id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Supplier</Label><Select value={f.supplier_name || "none"} onValueChange={(v) => { const s = cfg.suppliers.find((x) => x.name === v); set({ supplier_name: v === "none" ? "" : v, supplier_email: s?.email || f.supplier_email, values: v === "none" ? f.values : alignToSupplier(f.values, cfg, v) }); }}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Choose later</SelectItem>{cfg.suppliers.filter((s) => s.name).map((s) => <SelectItem key={s.name} value={s.name}>{s.name}{s.package ? " (package)" : ""}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Supplier email</Label><Input className="h-11" type="email" value={f.supplier_email} onChange={(e) => set({ supplier_email: e.target.value })} /></div>
          </div>
          {supplier?.package && <p className="text-xs text-muted-foreground">Door, machine, controller and fixture choices are limited to what {supplier.name} offers.</p>}

          <details className="rounded-lg border p-3" open={Object.values(f.values).some(Boolean) && !f.source_sheet}>
          <summary className="cursor-pointer text-sm font-medium">Equipment specifications (optional — internal, not shown to the client)</summary>
          <div className="mt-3 space-y-3">
          {RFQ_SECTIONS.map((s) => (
            <fieldset key={s.title} className="space-y-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">{s.title}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {s.fields.map((field) => {
                  const val = f.values[field.key] ?? "";
                  const label = <Label className="text-xs">{field.label}{field.unit ? ` (${field.unit})` : ""}</Label>;
                  if (field.type !== "select") return <div key={field.key} className="space-y-1">{label}<Input className="h-10" inputMode={field.type === "number" ? "numeric" : undefined} placeholder={field.key === "persons" ? String(suggestedPersons(f.values["load"] ?? "") ?? "") : undefined} value={val} onChange={(e) => setVal(field.key, e.target.value)} />{field.key === "pit" && Number(val) > 0 && Number(val) < 1000 && <p className="text-xs text-destructive">Below 1000 mm — check EN 81-20 reduced pit measures.</p>}</div>;
                  const opts = optionsFor(field, cfg, f.supplier_name);
                  const only = !f.supplier_name ? suppliersOffering(field, val, cfg) : []; const one = only.length === 1 ? only[0]! : null;
                  return <div key={field.key} className="space-y-1">{label}<Select value={val || "none"} onValueChange={(v) => setVal(field.key, v === "none" ? "" : v)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{[...new Set(val && !opts.includes(val) ? [...opts, val] : opts)].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>{one && <button type="button" className="text-left text-xs text-primary underline" onClick={() => { const sup = cfg.suppliers.find((x) => x.name === one); set({ supplier_name: one, supplier_email: sup?.email || f.supplier_email, values: alignToSupplier(f.values, cfg, one) }); }}>Only from {one} — use this supplier</button>}</div>;
                })}
              </div>
            </fieldset>
          ))}
          </div>
          </details>

          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Site contact</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input className="h-10" placeholder="Full name" value={f.contact.name ?? ""} onChange={(e) => set({ contact: { ...f.contact, name: e.target.value } })} />
              <Select value={f.contact.role || "none"} onValueChange={(v) => set({ contact: { ...f.contact, role: v === "none" ? "" : v } })}><SelectTrigger className="h-10"><SelectValue placeholder="Role on site" /></SelectTrigger><SelectContent><SelectItem value="none">Role on site</SelectItem>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              <Input className="h-10" type="tel" placeholder="Mobile / WhatsApp" value={f.contact.phone ?? ""} onChange={(e) => set({ contact: { ...f.contact, phone: e.target.value } })} />
              <Input className="h-10" type="email" placeholder="Email" value={f.contact.email ?? ""} onChange={(e) => set({ contact: { ...f.contact, email: e.target.value } })} />
            </div>
            <Input className="h-10" placeholder="Site access (key safe, machine room key…)" value={f.contact.access ?? ""} onChange={(e) => set({ contact: { ...f.contact, access: e.target.value } })} />
          </fieldset>

          <div className="space-y-1.5"><Label>Description, notes & parts to replace</Label><Textarea rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setSketching(true)}><PencilRuler className="mr-1 h-4 w-4" />{f.sketch ? "Edit sketch" : "Sketch layout"}</Button>
              <Label htmlFor="est-camera" className="inline-flex h-10 cursor-pointer items-center rounded-md border px-3 text-sm"><Camera className="mr-1 h-4 w-4" />Camera</Label>
              <input id="est-camera" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
              <Label htmlFor="est-gallery" className="inline-flex h-10 cursor-pointer items-center rounded-md border px-3 text-sm"><ImagePlus className="mr-1 h-4 w-4" />Photo gallery</Label>
              <input id="est-gallery" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </div>
            {f.sketch && <img src={f.sketch} alt="Layout sketch" className="h-32 rounded border bg-background object-contain" />}
            {!!f.photos.length && <div className="grid grid-cols-3 gap-2">{f.photos.map((p) => <div key={p} className="relative">{urls[p] ? <img src={urls[p]} alt="Site photo" className="aspect-square w-full rounded object-cover" /> : <div className="aspect-square rounded bg-muted" />}<button type="button" aria-label="Remove photo" className="absolute right-1 top-1 rounded-full bg-background/90 p-1" onClick={() => set({ photos: f.photos.filter((x) => x !== p) })}><X className="h-3 w-3" /></button></div>)}</div>}
          </div>
          <Button className="h-11 w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save estimate"}</Button>
        </div>
        <SketchPad open={sketching} initial={f.sketch} onClose={() => setSketching(false)} onSave={(png) => set({ sketch: png })} />
      </DialogContent>
    </Dialog>
  );
}
