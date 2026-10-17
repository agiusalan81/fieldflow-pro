import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Car, Lock, MapPin, Plus, Save, Send, Trash2, ShieldAlert, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers, initialsOf, isManager } from "@/lib/profile";
import { hoursFromTimes, missingSignOff, roundTo15, shiftTime } from "@/lib/jobsheets";
import { SearchSelect } from "@/components/search-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/sheets/$sheetId")({
  head: () => ({
    meta: [
      { title: "Job sheet — FieldOps" },
      { name: "description", content: "Fill in a job sheet: asset, time sheet, parts, notes and client sign-off." },
      { property: "og:title", content: "Job sheet — FieldOps" },
      { property: "og:description", content: "Job sheet form." },
    ],
  }),
  component: SheetForm,
});

type Log = {
  log_date: string; time_in: string; time_out: string;
  latitude_in: number | null; longitude_in: number | null; latitude_out: number | null; longitude_out: number | null;
  traveling_time_hours: number; technician_initials: string[]; daily_work_description: string;
};
type Part = { part_description: string; unit: string; quantity: number; time_acquiring_parts_hours: number; log_sort_order: number | null };

const emptyLog = (): Log => ({
  log_date: new Date().toISOString().slice(0, 10), time_in: "", time_out: "",
  latitude_in: null, longitude_in: null, latitude_out: null, longitude_out: null,
  traveling_time_hours: 0, technician_initials: [], daily_work_description: "",
});
const emptyPart = (): Part => ({ part_description: "", unit: "pcs", quantity: 1, time_acquiring_parts_hours: 0, log_sort_order: null });
const nowHM = () => new Date().toTimeString().slice(0, 5);

const FIELDS = [
  "client_id", "site_id", "asset_id", "asset_type", "asset_type_other", "lift_model", "serial_number", "requires_admin_approval",
  "is_tech_assistance", "is_maintenance", "is_installation", "job_type_other", "maintenance_agreement_type",
  "reported_fault", "repairs_performed", "pending_works_future_jobs", "internal_comments_admin_only",
  "technician_name", "client_full_name", "client_id_card_no", "signature_data",
] as const;
type Form = Record<(typeof FIELDS)[number], string | boolean | null>;

function captureGps(): Promise<{ lat: number; lng: number; simulated: boolean }> {
  return new Promise((resolve) => {
    const fallback = () => resolve({ lat: 35.9 + Math.random() * 0.05, lng: 14.45 + Math.random() * 0.05, simulated: true });
    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, simulated: false }),
      fallback,
      { timeout: 5000 },
    );
  });
}

function Section({ n, title, children, priv }: { n: number; title: string; children: React.ReactNode; priv?: boolean }) {
  return (
  <section className="rounded-xl border bg-card p-4 sm:p-5">
    <h2 className="mb-4 flex items-center gap-2 font-medium text-foreground">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs text-primary">{n}</span>{title}
      {priv && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
    </h2>
    {children}
  </section>
);
}

function SheetForm() {
  const { sheetId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: users = [] } = useCompanyUsers();

  const { data } = useQuery({
    queryKey: ["sheet", sheetId],
    queryFn: async () => {
      const [s, l, p] = await Promise.all([
        supabase.from("job_sheets").select("*").eq("id", sheetId).maybeSingle(),
        supabase.from("jobsheet_time_logs").select("*").eq("jobsheet_id", sheetId).order("sort_order"),
        supabase.from("jobsheet_parts").select("*").eq("jobsheet_id", sheetId).order("sort_order"),
      ]);
      if (s.error) throw s.error;
      return { sheet: s.data, logs: l.data ?? [], parts: p.data ?? [] };
    },
  });
  const { data: refs } = useQuery({
    queryKey: ["sheet-refs"],
    queryFn: async () => {
      const [c, s, a] = await Promise.all([
        supabase.from("clients").select("id, name, billing_address").order("name"),
        supabase.from("sites").select("id, client_id, name, address").order("name"),
        supabase.from("assets").select("id, client_id, site_id, reference_number, asset_category, location_details, custom_attributes, serial_number"),
      ]);
      return { clients: c.data ?? [], sites: s.data ?? [], assets: a.data ?? [] };
    },
  });

  const [form, setForm] = useState<Form | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [sigKey, setSigKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data?.sheet || form) return;
    const f = {} as Form;
    for (const k of FIELDS) f[k] = (data.sheet as Record<string, unknown>)[k] as never;
    setForm(f);
    setLogs(data.logs.map((l) => ({
      log_date: l.log_date, time_in: l.time_in?.slice(0, 5) ?? "", time_out: l.time_out?.slice(0, 5) ?? "",
      latitude_in: l.latitude_in, longitude_in: l.longitude_in, latitude_out: l.latitude_out, longitude_out: l.longitude_out,
      traveling_time_hours: Number(l.traveling_time_hours), technician_initials: l.technician_initials ?? [], daily_work_description: l.daily_work_description ?? "",
    })));
    setParts(data.parts.map((p) => ({ part_description: p.part_description, unit: p.unit ?? "", quantity: Number(p.quantity), time_acquiring_parts_hours: Number(p.time_acquiring_parts_hours), log_sort_order: p.log_sort_order })));
  }, [data, form]);

  if (data && !data.sheet) return <AppShell title="Job sheet"><p className="text-muted-foreground">This job sheet doesn't exist or isn't yours.</p></AppShell>;
  if (!data?.sheet || !form || !profile) return <AppShell title="Job sheet"><p className="text-muted-foreground">Loading…</p></AppShell>;

  const sheet = data.sheet;
  const readOnly = sheet.status === "completed";
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const client = refs?.clients.find((c) => c.id === form.client_id);
  const sites = refs?.sites.filter((s) => s.client_id === form.client_id) ?? [];
  const site = sites.find((s) => s.id === form.site_id);
  const assets = refs?.assets.filter((a) => a.client_id === form.client_id && (!form.site_id || !a.site_id || a.site_id === form.site_id)) ?? [];
  const asset = refs?.assets.find((a) => a.id === form.asset_id);
  const techs = users.map((u) => initialsOf(u));

  const assetPatch = (id: string | null): Partial<Form> => {
    const a = refs?.assets.find((x) => x.id === id);
    if (!a) return { asset_id: null };
    const attrs = (a.custom_attributes ?? {}) as Record<string, unknown>;
    const cat = (a.asset_category ?? "").toLowerCase();
    return {
      asset_id: a.id,
      asset_type: cat.includes("escalator") ? "Escalator" : cat.includes("lift") ? "Lift" : "Other",
      asset_type_other: cat.includes("lift") || cat.includes("escalator") ? null : a.asset_category,
      lift_model: (attrs["model"] as string) ?? form.lift_model,
      serial_number: a.serial_number ?? (attrs["serial"] as string) ?? form.serial_number,
    };
  };
  const pickAsset = (id: string) => set(assetPatch(id));
  const pickSite = (id: string) => {
    const here = refs?.assets.filter((a) => a.client_id === form.client_id && a.site_id === id) ?? [];
    set({ site_id: id, ...(here.length === 1 ? assetPatch(here[0]!.id) : { asset_id: null }) });
  };

  const persist = async (status?: string) => {
    setBusy(true);
    try {
      const repairs = logs.map((l) => l.daily_work_description.trim()).filter(Boolean).join("\n") || (form.repairs_performed as string | null);
      const { error } = await supabase.from("job_sheets").update({ ...form, repairs_performed: repairs, ...(status ? { status } : {}) } as never).eq("id", sheetId);
      if (error) throw error;
      await supabase.from("jobsheet_time_logs").delete().eq("jobsheet_id", sheetId);
      await supabase.from("jobsheet_parts").delete().eq("jobsheet_id", sheetId);
      if (logs.length) {
        const { error: e } = await supabase.from("jobsheet_time_logs").insert(logs.map((l, i) => ({
          ...l, time_in: l.time_in || null, time_out: l.time_out || null, jobsheet_id: sheetId, company_id: profile.company_id, sort_order: i,
          daily_total_hours: hoursFromTimes(l.time_in, l.time_out) + Number(l.traveling_time_hours || 0),
        })));
        if (e) throw e;
      }
      const ps = parts.filter((p) => p.part_description.trim());
      if (ps.length) {
        const { error: e } = await supabase.from("jobsheet_parts").insert(ps.map((p, i) => ({ ...p, jobsheet_id: sheetId, company_id: profile.company_id, sort_order: i })));
        if (e) throw e;
      }
      qc.invalidateQueries({ queryKey: ["sheet", sheetId] });
      qc.invalidateQueries({ queryKey: ["sheets"] });
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => { if (await persist(sheet.status === "draft" ? "draft" : undefined)) toast.success("Draft saved"); };
  const inTransit = async () => {
    if (await persist("in_transit")) {
      if (sheet.job_id) await supabase.from("jobs").update({ acknowledged_at: new Date().toISOString() }).eq("id", sheet.job_id);
      toast.success(`SMS / WhatsApp sent to ${client?.name ?? "client"}: “Your technician is on the way.” (simulated)`);
      setForm(null);
    }
  };
  const submit = async () => {
    const missing = missingSignOff({ client_full_name: form.client_full_name as string, client_id_card_no: form.client_id_card_no as string, signature: form.signature_data as string });
    if (missing.length) { toast.error(`Can't submit — missing: ${missing.join(", ")}`); return; }
    if (await persist("completed")) {
      await supabase.from("job_sheets").update({ work_end_time: new Date().toISOString() }).eq("id", sheetId);
      const { data: rec } = await supabase.from("client_contacts").select("email").eq("client_id", sheet.client_id).eq("receives_job_sheets", true);
      const emails = (rec ?? []).map((r) => r.email).filter(Boolean);
      toast.success(`Job sheet ${sheet.jobsheet_number} submitted and emailed to ${emails.length ? emails.join(", ") : "no recipients (none ticked)"} (simulated)`);
      navigate({ to: "/sheets" });
    }
  };
  const discard = async () => {
    if (sheet.status === "draft") {
      const { error } = await supabase.from("job_sheets").delete().eq("id", sheetId);
      if (error) { toast.error(error.message); return; }
      qc.invalidateQueries({ queryKey: ["sheets"] });
      toast.success("Draft discarded");
      navigate({ to: "/sheets" });
      return;
    }
    const cleared = { ...form } as Form;
    for (const k of ["reported_fault", "repairs_performed", "pending_works_future_jobs", "internal_comments_admin_only", "client_full_name", "client_id_card_no", "signature_data", "job_type_other", "maintenance_agreement_type"] as const) cleared[k] = null;
    for (const k of ["is_tech_assistance", "is_maintenance", "is_installation"] as const) cleared[k] = false;
    setForm(cleared); setLogs([]); setParts([]); setSigKey((n) => n + 1);
    toast.success("Form cleared — save to keep the change");
  };

  const setLog = (i: number, patch: Partial<Log>) => setLogs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setPart = (i: number, patch: Partial<Part>) => setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const removeDay = (i: number) => {
    setLogs(logs.filter((_, j) => j !== i));
    setParts(parts.filter((p) => p.log_sort_order !== i).map((p) => (p.log_sort_order != null && p.log_sort_order > i ? { ...p, log_sort_order: p.log_sort_order - 1 } : p)));
  };
  const gps = async (i: number, which: "in" | "out") => {
    const g = await captureGps();
    setLog(i, which === "in" ? { latitude_in: g.lat, longitude_in: g.lng } : { latitude_out: g.lat, longitude_out: g.lng });
    toast.success(`Location ${which === "in" ? "in" : "out"} captured${g.simulated ? " (simulated)" : ""}`);
  };
  const totalHours = logs.reduce((s, l) => s + hoursFromTimes(l.time_in, l.time_out) + Number(l.traveling_time_hours || 0), 0);
  const manager = isManager(profile);
  const address = site?.address || asset?.location_details || client?.billing_address || "";


  return (
    <AppShell
      title={`Job sheet ${sheet.jobsheet_number}`}
      actions={<Button asChild variant="ghost" size="sm"><Link to="/sheets"><ArrowLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Sheets</span></Link></Button>}
    >
      <fieldset disabled={readOnly || busy} className="mx-auto max-w-5xl space-y-4 pb-24">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={sheet.status} />
          {readOnly && <span className="text-sm text-muted-foreground">Completed — read-only view</span>}
          {form.requires_admin_approval && <span className="inline-flex items-center gap-1 rounded-full bg-warning/25 px-2.5 py-0.5 text-xs text-warning-foreground"><ShieldAlert className="h-3 w-3" />Needs admin approval</span>}
        </div>

        <Section n={1} title="Header & client info">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Job sheet no.</Label><Input value={sheet.jobsheet_number} readOnly className="h-11 font-mono" /></div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <SearchSelect value={form.client_id as string} placeholder="Choose client" disabled={readOnly}
                options={(refs?.clients ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.billing_address ?? undefined }))}
                onChange={(v) => set({ client_id: v, site_id: null, asset_id: null })} />
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <SearchSelect value={form.site_id as string} placeholder="Choose site" disabled={readOnly}
                options={sites.map((s) => ({ value: s.id, label: s.name, hint: s.address ?? undefined }))}
                onChange={pickSite} />
            </div>
            <div className="space-y-1.5">
              <Label>Lift / asset</Label>
              <SearchSelect value={form.asset_id as string} placeholder="Type reference, type or serial…" disabled={readOnly}
                options={assets.map((a) => ({ value: a.id, label: `${a.reference_number} · ${a.asset_category}`, hint: a.serial_number ?? undefined }))}
                onChange={pickAsset} />
            </div>
            <div className="space-y-1.5"><Label>Technician</Label><Input className="h-11" value={(form.technician_name as string) ?? ""} onChange={(e) => set({ technician_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input className="h-11" readOnly value={new Date(sheet.created_at).toLocaleDateString()} /></div>
          </div>
          {address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="mt-3 flex items-start gap-1.5 text-left text-sm text-primary underline-offset-2 hover:underline">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />{address}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Open in Google Maps</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href={`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`} target="_blank" rel="noreferrer">Open in Waze</a></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />No address on file</p>}
        </Section>

        <Section n={2} title="Asset">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Asset type</Label>
              <Select value={(form.asset_type as string) ?? "Lift"} onValueChange={(v) => set({ asset_type: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{["Lift", "Escalator", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.asset_type === "Other" && <div className="space-y-1.5"><Label>Specify</Label><Input className="h-11" value={(form.asset_type_other as string) ?? ""} onChange={(e) => set({ asset_type_other: e.target.value })} /></div>}
            <div className="space-y-1.5"><Label>Model</Label><Input className="h-11" value={(form.lift_model as string) ?? ""} onChange={(e) => set({ lift_model: e.target.value, requires_admin_approval: true })} /></div>
            <div className="space-y-1.5"><Label>Serial number</Label><Input className="h-11" value={(form.serial_number as string) ?? ""} onChange={(e) => set({ serial_number: e.target.value, requires_admin_approval: true })} /></div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Filled in automatically from the chosen lift. Changing the model or serial number sends this sheet to an admin for approval.</p>
        </Section>

        <Section n={3} title="Work classification">
          <div className="grid gap-3 sm:grid-cols-3">
            {([["is_tech_assistance", "Technical assistance"], ["is_maintenance", "Maintenance"], ["is_installation", "Installation"]] as const).map(([k, l]) => (
              <label key={k} className="flex h-11 items-center gap-3 rounded-md border px-3 text-sm">
                <Checkbox checked={!!form[k]} onCheckedChange={(c) => set({ [k]: !!c })} />{l}
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Other job type</Label><Input className="h-11" value={(form.job_type_other as string) ?? ""} onChange={(e) => set({ job_type_other: e.target.value })} /></div>
            {manager && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Maintenance agreement (office only)</Label>
                <Select value={(form.maintenance_agreement_type as string) ?? "none"} onValueChange={(v) => set({ maintenance_agreement_type: v === "none" ? null : v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{["none", "Comprehensive", "Standard", "Call-out only", "Warranty"].map((t) => <SelectItem key={t} value={t}>{t === "none" ? "None" : t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Section>

        <Section n={4} title={`Work log · ${totalHours.toFixed(2)} h total`}>
          <div className="mb-4 space-y-1.5">
            <Label>Reported fault</Label>
            {sheet.job_id && <p className="text-xs text-muted-foreground">Filled in from the assigned job card.</p>}
            <Textarea rows={2} value={(form.reported_fault as string) ?? ""} onChange={(e) => set({ reported_fault: e.target.value })} />
          </div>
          <div className="space-y-3">
            {logs.map((l, i) => {
              const day = hoursFromTimes(l.time_in, l.time_out) + Number(l.traveling_time_hours || 0);
              const dayParts = parts.map((p, j) => ({ p, j })).filter(({ p }) => p.log_sort_order === i);
              return (
                <div key={i} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Day {i + 1} · <span className="tabular-nums text-muted-foreground">{day.toFixed(2)} h</span></span>
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove day" onClick={() => removeDay(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="col-span-2 space-y-1 md:col-span-1"><Label className="text-xs">Date</Label><Input type="date" className="h-11" value={l.log_date} onChange={(e) => setLog(i, { log_date: e.target.value })} /></div>
                    {(["in", "out"] as const).map((w) => {
                      const k = w === "in" ? "time_in" : "time_out";
                      const setT = (v: string) => { setLog(i, { [k]: v }); if ((w === "in" ? l.latitude_in : l.latitude_out) == null) gps(i, w); };
                      return (
                        <div key={w} className="space-y-1">
                          <Label className="text-xs">Time {w}</Label>
                          <div className="flex gap-1">
                            <Button type="button" size="icon" variant="outline" className="h-11 w-9 shrink-0" aria-label="minus 15 minutes" onClick={() => setT(shiftTime(l[k], -15))}>−</Button>
                            <Input type="time" step={900} className="h-11 min-w-0 px-2" value={l[k]} onChange={(e) => setLog(i, { [k]: e.target.value })} onBlur={(e) => e.target.value && setT(roundTo15(e.target.value))} />
                            <Button type="button" size="icon" variant="outline" className="h-11 w-9 shrink-0" aria-label="plus 15 minutes" onClick={() => setT(shiftTime(l[k] || nowHM(), l[k] ? 15 : 0))}>+</Button>
                          </div>
                          {!l[k] && <button type="button" className="text-xs text-primary" onClick={() => setT(roundTo15(nowHM()))}>Stamp now</button>}
                        </div>
                      );
                    })}
                    <div className="space-y-1"><Label className="text-xs">Travel h</Label><Input type="number" step="0.25" min="0" inputMode="decimal" className="h-11" value={l.traveling_time_hours} onChange={(e) => setLog(i, { traveling_time_hours: Number(e.target.value) })} /></div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    GPS in: {l.latitude_in != null ? `${l.latitude_in.toFixed(4)}, ${l.longitude_in?.toFixed(4)}` : "—"} · out: {l.latitude_out != null ? `${l.latitude_out.toFixed(4)}, ${l.longitude_out?.toFixed(4)}` : "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {techs.map((t) => {
                      const on = l.technician_initials.includes(t);
                      return (
                        <button key={t} type="button" onClick={() => setLog(i, { technician_initials: on ? l.technician_initials.filter((x) => x !== t) : [...l.technician_initials, t] })}
                          className={`h-8 rounded-full border px-3 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
                      );
                    })}
                  </div>
                  <div className="mt-3 space-y-1"><Label className="text-xs">Repairs done this day</Label>
                    <Textarea rows={2} value={l.daily_work_description} onChange={(e) => setLog(i, { daily_work_description: e.target.value })} />
                  </div>
                  <div className="mt-3 space-y-2">
                    <Label className="text-xs">Parts used</Label>
                    {dayParts.map(({ p, j }) => (
                      <div key={j} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:grid-cols-[minmax(0,1fr)_80px_80px_110px_auto]">
                        <Input className="col-span-2 h-10 md:col-span-1" placeholder="Part description" value={p.part_description} onChange={(e) => setPart(j, { part_description: e.target.value })} />
                        <div className="grid grid-cols-3 gap-2 md:contents">
                          <Input className="h-10" placeholder="Unit" value={p.unit} onChange={(e) => setPart(j, { unit: e.target.value })} />
                          <Input className="h-10" type="number" min="0" placeholder="Qty" value={p.quantity} onChange={(e) => setPart(j, { quantity: Number(e.target.value) })} />
                          <Input className="h-10" type="number" step="0.25" min="0" placeholder="Fetch h" title="Time acquiring parts (hours)" value={p.time_acquiring_parts_hours} onChange={(e) => setPart(j, { time_acquiring_parts_hours: Number(e.target.value) })} />
                        </div>
                        <Button type="button" size="icon" variant="ghost" aria-label="Remove part" onClick={() => setParts(parts.filter((_, x) => x !== j))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {dayParts.length > 0 && <p className="text-[11px] text-muted-foreground">description · unit · qty · hours spent acquiring parts</p>}
                    {!readOnly && <Button type="button" size="sm" variant="ghost" onClick={() => setParts([...parts, { ...emptyPart(), log_sort_order: i }])}><Plus className="mr-1 h-4 w-4" />Add part</Button>}
                  </div>
                </div>
              );
            })}
            {parts.some((p) => p.log_sort_order == null) && (
              <div className="rounded-lg border border-dashed p-3 text-sm">
                <p className="mb-1 text-muted-foreground">Parts not linked to a day:</p>
                {parts.filter((p) => p.log_sort_order == null).map((p, k) => <p key={k}>{p.quantity} {p.unit} · {p.part_description}</p>)}
              </div>
            )}
            {!readOnly && <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setLogs([...logs, { ...emptyLog(), time_in: roundTo15(nowHM()) }])}><Plus className="mr-1 h-4 w-4" />Add day</Button>}
          </div>
        </Section>

        <Section n={5} title="Internal only — never shown to client" priv>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Pending works / future jobs</Label>
              <p className="text-xs text-muted-foreground">Goes to the admin pending queue.</p>
              <Textarea rows={3} value={(form.pending_works_future_jobs as string) ?? ""} onChange={(e) => set({ pending_works_future_jobs: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Internal comments (admin only)</Label>
              <p className="text-xs text-muted-foreground">For the office team.</p>
              <Textarea rows={3} value={(form.internal_comments_admin_only as string) ?? ""} onChange={(e) => set({ internal_comments_admin_only: e.target.value })} />
            </div>
          </div>
        </Section>

        <Section n={6} title="Client sign-off">
          {form.signature_data ? (
            <div className="flex flex-wrap items-center gap-4">
              <img src={form.signature_data as string} alt="Client signature" className="h-24 rounded-lg border bg-card" />
              <div className="text-sm"><p className="font-medium">{form.client_full_name as string}</p><p className="text-muted-foreground">ID {form.client_id_card_no as string}</p></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Not signed yet.</p>}
          {!readOnly && (
            <Button type="button" className="mt-4 h-11 w-full sm:w-auto" onClick={() => setSignOpen(true)}>
              <PenLine className="mr-1 h-4 w-4" />{form.signature_data ? "Re-open client sign-off" : "Present to client for sign-off"}
            </Button>
          )}
        </Section>
      </fieldset>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-h-[100dvh] max-w-3xl overflow-y-auto sm:max-h-[95vh]">
          <DialogHeader><DialogTitle>Job sheet {sheet.jobsheet_number} — client copy</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
              <p><span className="text-muted-foreground">Client:</span> {client?.name ?? "—"}</p>
              <p><span className="text-muted-foreground">Date:</span> {new Date(sheet.created_at).toLocaleDateString()}</p>
              <p className="sm:col-span-2"><span className="text-muted-foreground">Address:</span> {address || "—"}</p>
              <p><span className="text-muted-foreground">Equipment:</span> {asset ? `${asset.reference_number} · ${asset.asset_category}` : (form.asset_type as string)}</p>
              <p><span className="text-muted-foreground">Serial:</span> {(form.serial_number as string) || "—"}</p>
            </div>
            {form.reported_fault && <div><p className="font-medium">Reported fault</p><p className="whitespace-pre-wrap text-muted-foreground">{form.reported_fault as string}</p></div>}
            <div>
              <p className="font-medium">Work carried out</p>
              {logs.length === 0 ? <p className="text-muted-foreground">—</p> : logs.map((l, i) => (
                <p key={i} className="text-muted-foreground"><span className="text-foreground">{l.log_date} {l.time_in}–{l.time_out}:</span> {l.daily_work_description || "—"}</p>
              ))}
            </div>
            {parts.filter((p) => p.part_description.trim()).length > 0 && (
              <div><p className="font-medium">Parts replaced</p>
                <ul className="list-inside list-disc text-muted-foreground">{parts.filter((p) => p.part_description.trim()).map((p, i) => <li key={i}>{p.quantity} {p.unit} · {p.part_description}</li>)}</ul>
              </div>
            )}
            <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label>Full name *</Label><Input className="h-11" value={(form.client_full_name as string) ?? ""} onChange={(e) => set({ client_full_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>ID card no. *</Label><Input className="h-11" value={(form.client_id_card_no as string) ?? ""} onChange={(e) => set({ client_id_card_no: e.target.value })} /></div>
            </div>
            <div><Label>Signature *</Label><div className="mt-1.5"><SignaturePad key={sigKey} value={form.signature_data as string | null} onChange={(v) => set({ signature_data: v })} /></div></div>
            <Button className="h-11 w-full" onClick={() => {
              const missing = missingSignOff({ client_full_name: form.client_full_name as string, client_id_card_no: form.client_id_card_no as string, signature: form.signature_data as string });
              if (missing.length) { toast.error(`Missing: ${missing.join(", ")}`); return; }
              setSignOpen(false); toast.success("Signed — hand the device back to the technician");
            }}>Confirm & sign</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-card/95 p-3 backdrop-blur lg:bottom-0 lg:left-[240px]">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" className="h-11" disabled={busy} onClick={saveDraft}><Save className="mr-1 h-4 w-4" />Save as Draft</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" className="h-11" disabled={busy}><Trash2 className="mr-1 h-4 w-4" />{sheet.status === "draft" ? "Discard Draft" : "Clear Form"}</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{sheet.status === "draft" ? "Discard this draft?" : "Clear this form?"}</AlertDialogTitle>
                  <AlertDialogDescription>{sheet.status === "draft" ? `Job sheet ${sheet.jobsheet_number} and everything in it will be deleted.` : "All notes, time rows, parts and the signature will be wiped."} This can't be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={discard}>Yes, wipe it</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="secondary" className="h-11" disabled={busy || sheet.status === "in_transit"} onClick={inTransit}><Car className="mr-1 h-4 w-4" />In Transit</Button>
            <Button className="h-11" disabled={busy} onClick={submit}><Send className="mr-1 h-4 w-4" />Submit & Send Email</Button>
          </div>
        </div>
      )}
      {readOnly && isManager(profile) && <p className="mx-auto max-w-5xl text-xs text-muted-foreground">Status can be changed from the Job sheets admin page.</p>}
    </AppShell>
  );
}
