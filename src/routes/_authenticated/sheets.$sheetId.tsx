import { TravelPicker } from "@/components/travel-picker";
import { JobsheetInternalNotes, InternalThread } from "@/components/jobsheet-internal-notes";
import { sheetFingerprint } from "@/lib/sheet-dirty";
import { JobReceipts } from "@/components/job-receipts";
import { useEntrySuggestions } from "@/hooks/use-entry-suggestions";
import { SuggestedTextarea } from "@/components/suggested-textarea";
import { DiscardOfflineDraft } from "@/components/discard-offline-draft";
import { pendingReceipts, syncReceipts } from "@/lib/receipt-queue";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Car, Lock, MapPin, Plus, Save, Send, Trash2, ShieldAlert, PenLine, ChevronLeft, ChevronRight } from "lucide-react";
import { readSheetOrder, neighbours } from "@/lib/sheet-nav";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers, initialsOf, isManager } from "@/lib/profile";
import { remindBreakIfDue } from "@/lib/dwr-report";
import { useCompanyRules, useTerminology } from "@/lib/company";
import { ReportSharing } from "@/components/report-sharing";
import { scheduledInitials, assignmentFilter, hoursFromTimes, missingSignOff, missingChecklist, roundTo15, shiftTime, parsePhotos, createDraftSheet, type JobPhoto, technicianCount, labourHours, dayLabourHours } from "@/lib/jobsheets";
import { JobPhotos } from "@/components/job-photos";
import { SpecialNotes } from "@/components/special-notes";
import { VoiceDictation } from "@/components/voice-dictation";
import { sendJobSheetEmail } from "@/lib/sendJobSheetEmail";
import { TechnicianPicker } from "@/components/technician-picker";
import { SearchSelect } from "@/components/search-select";
import { TimePicker } from "@/components/time-picker";
import { NumInput } from "@/components/num-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppShell, StatusBadge, BackButton } from "@/components/app-shell";
import type { Profile } from "@/lib/profile";
import { SignaturePad } from "@/components/signature-pad";
import { DepartureRequest } from "@/components/client-notices";
import { draftKey, getLocalDraft, saveLocalDraft, syncDraft, removeLocalDraft, type DraftSnapshot } from "@/lib/offline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/sheets/$sheetId")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Job sheet — FieldBridge" },
      { name: "description", content: "Fill in a job sheet: asset, time sheet, parts, notes and client sign-off." },
      { property: "og:title", content: "Job sheet — FieldBridge" },
      { property: "og:description", content: "Job sheet form." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SheetRoute,
});

function SheetStepper({ sheetId }: { sheetId: string }) {
  const navigate = useNavigate();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { setIds(readSheetOrder()); }, []);
  const n = neighbours(ids, sheetId);
  if (n.index < 0) return null;
  const go = (id: string | null) => { if (id) void navigate({ to: "/sheets/$sheetId", params: { sheetId: id } }); };
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <Button variant="outline" className="h-11 min-w-28" disabled={!n.prev} onClick={() => go(n.prev)} aria-label="Previous job sheet"><ChevronLeft className="h-4 w-4" />Previous</Button>
      <span className="rounded-md border bg-muted px-3 py-2 text-sm font-medium tabular-nums text-foreground">Sheet {n.index + 1} of {n.total}</span>
      <Button variant="outline" className="h-11 min-w-28" disabled={!n.next} onClick={() => go(n.next)} aria-label="Next job sheet">Next<ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

type Log = {
  log_date: string; time_in: string; time_out: string;
  latitude_in: number | null; longitude_in: number | null; latitude_out: number | null; longitude_out: number | null;
  traveling_time_hours: number; technician_count: number; technician_initials: string[]; daily_work_description: string;
};
type Part = { part_description: string; unit: string; quantity: number; time_acquiring_parts_hours: number; log_sort_order: number | null };

const emptyLog = (): Log => ({
  log_date: new Date().toISOString().slice(0, 10), time_in: "", time_out: "",
  latitude_in: null, longitude_in: null, latitude_out: null, longitude_out: null,
  traveling_time_hours: 0, technician_count: 1, technician_initials: [], daily_work_description: "",
});
const emptyPart = (): Part => ({ part_description: "", unit: "pcs", quantity: 1, time_acquiring_parts_hours: 0, log_sort_order: null });
const nowHM = () => new Date().toTimeString().slice(0, 5);

const FIELDS = [
  "client_id", "site_id", "asset_id", "asset_type", "asset_type_other", "lift_model", "serial_number", "requires_admin_approval",
  "is_tech_assistance", "is_maintenance", "is_installation", "job_type_other", "maintenance_agreement_type",
  "reported_fault", "repairs_performed", "pending_works_future_jobs", "internal_comments_admin_only",
  "technician_name", "client_full_name", "client_id_card_no", "signature_data",
  "special_notes", "special_notes_in_pdf", "special_notes_in_email",
] as const;
type Form = Record<(typeof FIELDS)[number], string | boolean | null>;

function captureGps(): Promise<{ lat: number; lng: number }> {
 return new Promise((resolve,reject)=>{if(!navigator.geolocation){reject(new Error("Location unavailable"));return;}navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),()=>reject(new Error("Location permission unavailable. No location was recorded.")),{timeout:10000,maximumAge:30000});});
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

function SheetRoute(){const {sheetId}=Route.useParams();return <SheetForm key={sheetId}/>;}

function SheetForm() {
  const word = useTerminology();
  const { sheetId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: company } = useCompanyRules();
  const { data: users = [] } = useCompanyUsers();
  const { data: suggestions } = useEntrySuggestions();
  const cleanState=useRef<string|null>(null);
  const latestState=useRef<string>(" ");
  const revision = useRef<string | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [savedLocally, setSavedLocally] = useState<Date | null>(null);
  const [conflict, setConflict] = useState(false);

  const { data } = useQuery({
    queryKey: ["sheet", sheetId],
    queryFn: async () => {
      const [s, l, p] = await Promise.all([
        supabase.from("job_sheets").select("*").eq("id", sheetId).maybeSingle(),
        supabase.from("jobsheet_time_logs").select("*").eq("jobsheet_id", sheetId).order("sort_order"),
        supabase.from("jobsheet_parts").select("*").eq("jobsheet_id", sheetId).order("sort_order"),
      ]);
      if (s.error) throw s.error;
      const assignment = s.data?.job_id ? await supabase.from("jobs").select("assigned_technician_id, secondary_technician_id").eq("id", s.data.job_id).maybeSingle() : { data: null };
      return { assignment: assignment.data, sheet: s.data, logs: l.data ?? [], parts: p.data ?? [] };
    },
  });
  const { data: refs } = useQuery({
    queryKey: ["sheet-refs"],
    queryFn: async () => {
      const [c, s, a] = await Promise.all([
        supabase.from("clients").select("id, name, billing_address, preapprove_departure, waive_transport").order("name"),
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
  const [signOpen, setSignOpen] = useState(false);
  const [handOff, setHandOff] = useState(false);
  const [nextStop, setNextStop] = useState<NextJob | null>(null);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const { data: checklists = [] } = useQuery({
    queryKey: ["checklists"],
    queryFn: async () => (await supabase.from("checklist_templates").select("*")).data ?? [],
  });
  const { data: faults = [] } = useQuery({ queryKey: ["fault-library"], queryFn: async () => { const r = await supabase.from("fault_library").select("*").eq("active", true).order("fault"); if (r.error) throw r.error; return r.data; } });

  useEffect(() => {
    if (!data?.sheet || form) return;
    const f = {} as Form;
    for (const k of FIELDS) f[k] = (data.sheet as Record<string, unknown>)[k] as never;
    setForm(f);
    setPhotos(parsePhotos(data.sheet.photo_paths));
    setChecks((data.sheet.checklist_values ?? {}) as Record<string, boolean>);
    setLogs(data.logs.map((l) => ({
      log_date: l.log_date, time_in: l.time_in?.slice(0, 5) ?? "", time_out: l.time_out?.slice(0, 5) ?? "",
      latitude_in: l.latitude_in, longitude_in: l.longitude_in, latitude_out: l.latitude_out, longitude_out: l.longitude_out,
      traveling_time_hours: Number(l.traveling_time_hours), technician_count: technicianCount(l.technician_count, l.technician_initials), technician_initials: l.technician_initials ?? [], daily_work_description: l.daily_work_description ?? "",
    })));
    setParts(data.parts.map((p) => ({ part_description: p.part_description, unit: p.unit ?? "", quantity: Number(p.quantity), time_acquiring_parts_hours: Number(p.time_acquiring_parts_hours), log_sort_order: p.log_sort_order })));
  }, [data, form]);

  useEffect(() => {
    if (!profile || !data?.sheet || data.assignment?.secondary_technician_id === profile.id || localReady) return;
    revision.current = data.sheet.updated_at;
    void getLocalDraft(profile.id, sheetId).then((local) => {
      if (local) {
        setForm(local.form as Form); setChecks((local.form["checklist_values"] ?? {}) as Record<string, boolean>);
        setPhotos(parsePhotos(local.form["photo_paths"]));
        setLogs(local.logs.map((l) => ({ ...l, time_in: l["time_in"] ?? "", time_out: l["time_out"] ?? "" })) as Log[]);
        setParts(local.parts as Part[]); revision.current = local.expected;
        setConflict(!!local.error?.includes("CONFLICT"));
      }
      setLocalReady(true);
    }).catch(() => setLocalReady(true));
  }, [profile, data, localReady, sheetId]);

  latestState.current=sheetFingerprint({form,logs,parts,photos,checks});
  useEffect(() => {
    const synced = (event: Event) => {
      const detail = (event as CustomEvent<{ sheetId: string; updatedAt: string }>).detail;
      if (detail.sheetId === sheetId) { revision.current = detail.updatedAt; setConflict(false); }
    };
    window.addEventListener("fieldops-draft-synced", synced);
    return () => window.removeEventListener("fieldops-draft-synced", synced);
  }, [sheetId]);

  useEffect(() => {
    if (!profile || !data?.sheet || data.assignment?.secondary_technician_id === profile.id || !form || !localReady || data.sheet.status === "completed" || conflict) return;
    const fingerprint=sheetFingerprint({form,logs,parts,photos,checks});
    if(cleanState.current===null){cleanState.current=fingerprint;return;}
    if(cleanState.current===fingerprint||busy)return;
    const timer = setTimeout(() => {
      const expected = revision.current ?? data.sheet.updated_at;
      const snapshot: DraftSnapshot = {
        key: draftKey(profile.id, sheetId), userId: profile.id, sheetId, expected,
        form: { ...form, checklist_values: checks, photo_paths: photos, repairs_performed: logs.map((l) => l.daily_work_description.trim()).filter(Boolean).join("\n") || form.repairs_performed },
        logs: logs.map((l, i) => {
          const c = refs?.clients.find((x) => x.id === form.client_id);
          const travel = c?.waive_transport ? 0 : l.traveling_time_hours;
          const ph = parts.filter((p) => p.log_sort_order === i).reduce((s, p) => s + (Number(p.time_acquiring_parts_hours) || 0), 0);
          return { ...l, traveling_time_hours: travel, time_in: l.time_in || null, time_out: l.time_out || null, sort_order: i, daily_total_hours: dayLabourHours(l.time_in, l.time_out, travel, l.technician_count, l.technician_initials, ph) };
        }),
        parts: parts.filter((p) => p.part_description.trim()).map((p, i) => ({ ...p, sort_order: i })), savedAt: new Date().toISOString(),
      };
      void saveLocalDraft(snapshot).then(async () => {setSavedLocally(new Date());if(navigator.onLine){try{revision.current=await syncDraft(snapshot);cleanState.current=fingerprint;setSavedLocally(null);}catch(e){const message=e instanceof Error?e.message:"Could not sync";const current=await getLocalDraft(profile.id,sheetId);if(current?.savedAt===snapshot.savedAt)await saveLocalDraft({...current,error:message});if(message.includes("CONFLICT"))setConflict(true);}}}).catch(() => toast.error("This device could not save your draft. Free storage space and try again."));
    }, 750);
    return () => clearTimeout(timer);
  }, [profile, data, form, logs, parts, photos, checks, localReady, conflict, sheetId, busy]);

  if (data && !data.sheet) return <AppShell title="Job sheet"><div className="space-y-4"><p className="text-muted-foreground">This job sheet doesn't exist or isn't yours.</p>{profile && <DiscardOfflineDraft userId={profile.id} sheetId={sheetId} />}</div></AppShell>;
  if (!data?.sheet || !form || !profile) return <AppShell title="Job sheet"><p className="text-muted-foreground">Loading…</p></AppShell>;

  const sheet = data.sheet;
  const assisting = data.assignment?.secondary_technician_id === profile.id;
  const readOnly = sheet.status === "completed" || assisting;
  const staffing = scheduledInitials(data.assignment, users, profile);
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const client = refs?.clients.find((c) => c.id === form.client_id);
  const checkCat = form.asset_type === "Escalator" ? "Escalator" : form.asset_type === "Lift" ? "Elevator" : "Custom";
  const checklistItems = form.is_maintenance ? sheet.checklist_snapshot.length ? sheet.checklist_snapshot : ((checklists.find((c) => c.equipment_category === checkCat)?.items as string[] | undefined) ?? []) : [];
  const safetyItems = sheet.safety_snapshot;
  const sites = refs?.sites.filter((s) => s.client_id === form.client_id) ?? [];
  const site = sites.find((s) => s.id === form.site_id);
  const assets = refs?.assets.filter((a) => a.client_id === form.client_id && (!form.site_id || !a.site_id || a.site_id === form.site_id)) ?? [];
  const asset = refs?.assets.find((a) => a.id === form.asset_id);

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
    const only = here.length === 1 ? here[0] : undefined;
    set({ site_id: id, ...(only ? assetPatch(only.id) : { asset_id: null }) });
  };

  const persist = async (status?: string, savedLogs = logs) => {
    const bad = savedLogs.findIndex((l) => l.time_in && l.time_out && l.time_out < l.time_in);
    if (bad >= 0) { toast.error(`Day ${bad + 1}: time out must be after time in`); return false; }
    setBusy(true);
    try {
      const repairs = savedLogs.map((l) => l.daily_work_description.trim()).filter(Boolean).join("\n") || (form.repairs_performed as string | null);
      const snapshot: DraftSnapshot = {
        key: draftKey(profile.id, sheetId), userId: profile.id, sheetId, expected: revision.current ?? sheet.updated_at,
        form: { ...form, checklist_values: checks, photo_paths: photos, repairs_performed: repairs },
        logs: savedLogs.map((l, i) => {
          const travel = client?.waive_transport ? 0 : l.traveling_time_hours;
          return { ...l, traveling_time_hours: travel, time_in: l.time_in || null, time_out: l.time_out || null, sort_order: i, daily_total_hours: dayLabourHours(l.time_in, l.time_out, travel, l.technician_count, l.technician_initials, dayPartsHours(i)) };
        }),
        parts: parts.filter((p) => p.part_description.trim()).map((p, i) => ({ ...p, sort_order: i })), savedAt: new Date().toISOString(),
      };
      if (!navigator.onLine) {
        await saveLocalDraft(snapshot);
        toast.success("Draft saved on this device — will sync when connected");
        return !status || status === "draft";
      }
      const fingerprint = latestState.current;
      await saveLocalDraft(snapshot);
      try { revision.current = await syncDraft(snapshot); cleanState.current=fingerprint;setSavedLocally(null); }
      catch (e) {
        const message = (e as Error).message;
        const current = await getLocalDraft(profile.id, sheetId);
        if (current?.savedAt === snapshot.savedAt) await saveLocalDraft({ ...current, error: message });
        if (message.includes("CONFLICT")) setConflict(true);
        throw e;
      }
      if (status && status !== "draft") {
        const { data: updated, error } = await supabase.from("job_sheets").update({ status: status as "completed" | "in_progress", ...(status === "in_progress" ? { work_start_time: sheet.work_start_time ?? new Date().toISOString() } : {}) }).eq("id", sheetId).eq("updated_at", revision.current).select("updated_at").single();
        if (error) throw error;
        revision.current = updated.updated_at;
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

  const saveDraft = async () => { if (await persist(sheet.status === "draft" ? "draft" : undefined) && navigator.onLine) toast.success("Draft saved"); };
  const arrive = async (index?: number) => {
    if (!navigator.onLine) { toast.error("Connect to confirm arrival. Your draft can still be saved on this device."); return; }
    const today = new Date().toISOString().slice(0, 10);
    const target = index ?? logs.findIndex((l) => l.log_date === today && !l.time_out);
    const i = target < 0 ? logs.length : target;
    const next = target < 0 ? [...logs, { ...emptyLog(), technician_initials: staffing, technician_count: staffing.length }] : logs.map((l) => ({ ...l }));
    const log = next[i];
    if (!log) return;
    log.time_in ||= roundTo15(nowHM());
    if (await persist("in_progress", next)) {
      setLogs(next);
      void gps(i, "in");
      toast.success("Arrived on site");
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["job-travel-sheet"] });
    }
  };
  const submit = async () => {
    if (safetyItems.some((i) => !checks[`safety:${i}`])) { toast.error("Complete the safety assessment before submitting"); return; }
    if (!navigator.onLine) { toast.error("Connect to submit and email. Save as Draft to keep work on this device."); return; }
    const missing = missingSignOff({ client_full_name: form.client_full_name as string, client_id_card_no: form.client_id_card_no as string, signature: form.signature_data as string });
    if (missing.length) { toast.error(`Can't submit — missing: ${missing.join(", ")}`); return; }
    const unticked = missingChecklist(checklistItems, checks);
    if (unticked.length) { toast.error(`Can't submit — maintenance checklist not complete (${unticked.length} item${unticked.length > 1 ? "s" : ""} left)`); return; }
    await syncReceipts(profile.id);
    if ((await pendingReceipts(profile.id, sheetId)).length) { toast.error("Upload pending receipt PDFs before submitting this sheet."); return; }
    if (await persist("completed")) {
      await supabase.from("job_sheets").update({ work_end_time: new Date().toISOString() }).eq("id", sheetId);
      try {
        const result = await sendJobSheetEmail({ data: { sheetId } });
        toast.success(result.sent
          ? `Job sheet ${sheet.jobsheet_number} submitted and emailed to ${result.recipients.join(", ")}`
          : `Job sheet ${sheet.jobsheet_number} submitted — no email recipients ticked for this client`);
      } catch (e) {
        toast.error(`Submitted, but the email failed: ${(e as Error).message}`);
      }
      if (company) await remindBreakIfDue(profile.id, company.breaks, (m) => toast.info(m, { duration: 12000 }));
      const next = await findNextJob(profile.id, sheet.job_id);
      if (next) setNextStop(next); else navigate({ to: "/sheets" });
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
  const savePhotos = async (next: JobPhoto[]) => {
    setPhotos(next);
  };
  const photoProps = { companyId: profile.company_id, sheetId, photos, readOnly, onChange: savePhotos };
  const removeDay = (i: number) => {
    const shifted = photos.filter((p) => !(p.scope === "work" && p.day === i)).map((p) => (p.scope === "work" && p.day != null && p.day > i ? { ...p, day: p.day - 1 } : p));
    if (shifted.length !== photos.length || shifted.some((p, k) => p !== photos[k])) savePhotos(shifted);
    setLogs(logs.filter((_, j) => j !== i));
    setParts(parts.filter((p) => p.log_sort_order !== i).map((p) => (p.log_sort_order != null && p.log_sort_order > i ? { ...p, log_sort_order: p.log_sort_order - 1 } : p)));
  };
  const gps = async (i: number, which: "in" | "out") => {
    // Only record location when permission was already granted at Clock in — never prompt from the job sheet.
    try {
      const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      if (!perm || perm.state !== "granted") return;
      const g = await captureGps();
      setLog(i, which === "in" ? { latitude_in: g.lat, longitude_in: g.lng } : { latitude_out: g.lat, longitude_out: g.lng });
    } catch { /* location unavailable — leave coordinates empty */ }
  };
  const dayPartsHours = (i: number) => parts.filter((p) => p.log_sort_order === i).reduce((s, p) => s + (Number(p.time_acquiring_parts_hours) || 0), 0);
  const totalHours = logs.reduce((s, l, i) => s + dayLabourHours(l.time_in, l.time_out, l.traveling_time_hours, l.technician_count, l.technician_initials, dayPartsHours(i)), 0);
  const manager = isManager(profile);
  const address = site?.address || asset?.location_details || client?.billing_address || "";


  return (
    <AppShell
      title={`Job sheet ${sheet.jobsheet_number}`}
      actions={<BackButton fallback="/sheets" />}
    >
      {conflict && <div className="mx-auto mb-4 max-w-5xl border border-destructive p-3 text-sm"><p>This sheet changed on another device. Your local work has been kept. Compare it before saving.</p><Button variant="outline" className="mt-2" onClick={async () => {
        if (!confirm("Discard this device's saved changes and load the latest job sheet?")) return;
        cleanState.current=null; await removeLocalDraft(profile.id, sheetId); revision.current = sheet.updated_at; setConflict(false); setForm(null); setLocalReady(false); await qc.invalidateQueries({ queryKey: ["sheet", sheetId] });
      }}>Discard local changes &amp; reload</Button></div>}
      {readOnly && manager && <ReportSharing sheetId={sheetId} />}
      <JobReceipts userId={profile.id} companyId={profile.company_id} sheetId={sheetId} readOnly={busy} />
      {!form.signature_data && sheet.departure_status !== "none" && (
        <div className={`mx-auto mb-4 max-w-5xl rounded-xl border-2 p-4 text-sm ${sheet.departure_status === "approved" ? "border-success bg-success/10" : sheet.departure_status === "rejected" ? "border-destructive bg-destructive/10" : "border-warning bg-warning/15"}`}>
          <p className="font-medium text-foreground">{sheet.departure_status === "approved" ? "Approved — you may leave site. The client has been notified." : sheet.departure_status === "rejected" ? "Leaving was declined — please wait on site for the client." : "Waiting for approval to leave unsigned — please wait on site."}</p>
          {sheet.departure_reply && <p className="mt-1 text-foreground"><b>Message from your supervisor:</b> “{sheet.departure_reply}”</p>}
        </div>
      )}
      <fieldset disabled={readOnly || busy} className="mx-auto max-w-5xl space-y-4 pb-24">
        <datalist id="previous-part-descriptions">{suggestions?.parts.map(text => <option key={text} value={text} />)}</datalist>
        <datalist id="previous-part-units">{suggestions?.units.map(text => <option key={text} value={text} />)}</datalist>
        {safetyItems.length > 0 && <Section n={0} title="Pre-work safety assessment"><div className="space-y-2">{safetyItems.map((i) => <label key={i} className="flex items-start gap-3 border p-3 text-sm"><Checkbox checked={!!checks[`safety:${i}`]} onCheckedChange={(v) => setChecks({ ...checks, [`safety:${i}`]: !!v })} />{i}</label>)}</div></Section>}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={sheet.status} />
          {sheet.status === "in_transit" && <Button type="button" className="h-11" disabled={busy || !localReady} onClick={() => arrive()}><MapPin className="mr-1 h-4 w-4" />Arrive on site</Button>}
          {readOnly && <span className="text-sm text-muted-foreground">Completed — read-only view</span>}
          {form.requires_admin_approval && <span className="inline-flex items-center gap-1 rounded-full bg-warning/25 px-2.5 py-0.5 text-xs text-warning-foreground"><ShieldAlert className="h-3 w-3" />Needs admin approval</span>}
        </div>

        <Section n={1} title="Header & client info">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Job sheet no.</Label><Input value={sheet.jobsheet_number} readOnly className="h-11 font-mono" /></div>
            <div className="space-y-1.5">
              <Label>{word("client")}</Label>
              <SearchSelect value={form.client_id as string} placeholder="Choose client" disabled={readOnly}
                options={(refs?.clients ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.billing_address ?? undefined }))}
                onChange={(v) => set({ client_id: v, site_id: null, asset_id: null })} />
            </div>
            <div className="space-y-1.5">
              <Label>{word("site")}</Label>
              <SearchSelect value={form.site_id as string} placeholder="Choose site" disabled={readOnly}
                options={sites.map((s) => ({ value: s.id, label: s.name, hint: s.address ?? undefined }))}
                onChange={pickSite} />
            </div>
            <div className="space-y-1.5">
              <Label>{word("equipment")}</Label>
              <SearchSelect value={form.asset_id as string} placeholder="Type reference, type or serial…" disabled={readOnly}
                options={assets.map((a) => ({ value: a.id, label: `${a.reference_number} · ${a.asset_category}`, hint: a.serial_number ?? undefined }))}
                onChange={pickAsset} />
            </div>
            <div className="space-y-1.5"><Label>{word("technician")}</Label><Input className="h-11" value={(form.technician_name as string) ?? ""} onChange={(e) => set({ technician_name: e.target.value })} /></div>
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

        <Section n={2} title={word("equipment")}>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>{word("asset_type")}</Label>
              <Select value={(form.asset_type as string) ?? "Lift"} onValueChange={(v) => set({ asset_type: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{["Lift", "Escalator", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.asset_type === "Other" && <div className="space-y-1.5"><Label>Specify</Label><Input className="h-11" value={(form.asset_type_other as string) ?? ""} onChange={(e) => set({ asset_type_other: e.target.value })} /></div>}
            <div className="space-y-1.5"><Label>{word("model")}</Label><Input className="h-11" value={(form.lift_model as string) ?? ""} onChange={(e) => set({ lift_model: e.target.value, requires_admin_approval: true })} /></div>
            <div className="space-y-1.5"><Label>{word("serial")}</Label><Input className="h-11" value={(form.serial_number as string) ?? ""} onChange={(e) => set({ serial_number: e.target.value, requires_admin_approval: true })} /></div>
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

        {checklistItems.length > 0 && (
          <Section n={3} title={`${checkCat} maintenance checklist · ${checklistItems.length - missingChecklist(checklistItems, checks).length}/${checklistItems.length}`}>
            <p className="mb-3 text-xs text-muted-foreground">Required for maintenance visits — tick every item before submitting.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {checklistItems.map((it) => (
                <label key={it} className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <Checkbox disabled={readOnly} checked={!!checks[it]} onCheckedChange={(c) => setChecks({ ...checks, [it]: !!c })} />{it}
                </label>
              ))}
            </div>
          </Section>
        )}

        <Section n={4} title={`Work log · ${totalHours.toFixed(2)} h total`}>
          <div className="mb-4 space-y-1.5">
            <Label>{word("fault")}</Label>
            {faults.length > 0 && <SearchSelect value="" placeholder="Choose a saved fault / remedy" options={faults.map((f) => ({ value: f.id, label: f.fault, hint: f.trade }))} onChange={(id) => { const f = faults.find((x) => x.id === id); if (!f) return; set({ reported_fault: f.fault }); if (f.remedy && logs[0]) setLogs(logs.map((l, i) => i === 0 ? { ...l, daily_work_description: [l.daily_work_description, f.remedy].filter(Boolean).join("\n") } : l)); }} />}
            {sheet.job_id && <p className="text-xs text-muted-foreground">Filled in from the assigned job card.</p>}
            <SuggestedTextarea rows={2} aria-label="Reported fault" disabled={readOnly} value={(form.reported_fault as string) ?? ""} onValueChange={reported_fault => set({ reported_fault })} suggestions={suggestions?.faults} />
            <VoiceDictation label="reported fault" disabled={readOnly} value={(form.reported_fault as string) ?? ""} onApply={(t) => set({ reported_fault: t })} />
          </div>
          <div className="space-y-3">
            {logs.map((l, i) => {
              const day = dayLabourHours(l.time_in, l.time_out, l.traveling_time_hours, l.technician_count, l.technician_initials, dayPartsHours(i));
              const dayParts = parts.map((p, j) => ({ p, j })).filter(({ p }) => p.log_sort_order === i);
              return (
                <div key={i} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Day {i + 1} · <span className="tabular-nums text-muted-foreground">{day.toFixed(2)} h</span></span>
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove day" onClick={() => removeDay(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {!readOnly && (!l.time_in || !l.time_out) && (
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <Button type="button" className="h-11" variant={l.time_in ? "outline" : "default"} disabled={!!l.time_in}
                        onClick={() => { if (sheet.status === "in_transit") void arrive(i); else { setLog(i, { time_in: roundTo15(nowHM()) }); gps(i, "in"); } }}>
                        <MapPin className="mr-1 h-4 w-4" />{l.time_in ? `Arrived ${l.time_in}` : "Arrive on site"}
                      </Button>
                      <Button type="button" className="h-11" variant={l.time_in ? "default" : "outline"} disabled={!l.time_in}
                        onClick={() => { const t = roundTo15(nowHM()); setLog(i, { time_out: t < l.time_in ? l.time_in : t }); gps(i, "out"); }}>
                        <MapPin className="mr-1 h-4 w-4" />Depart site
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="col-span-2 space-y-1 md:col-span-1"><Label className="text-xs">Date</Label><Input type="date" className="h-11" value={l.log_date} onChange={(e) => setLog(i, { log_date: e.target.value })} /></div>
                    {(["in", "out"] as const).map((w) => {
                      const k = w === "in" ? "time_in" : "time_out";
                      const setT = (v: string) => { setLog(i, { [k]: v }); if ((w === "in" ? l.latitude_in : l.latitude_out) == null) gps(i, w); };
                      return (
                        <div key={w} className="space-y-1">
                          <Label className="text-xs">Time {w}</Label>
                          <TimePicker label={`Time ${w}`} disabled={readOnly} value={l[k]} onChange={(v) => setT(roundTo15(v))} />
                          {w === "out" && l.time_in && l.time_out && l.time_out < l.time_in && <p className="text-xs text-destructive">Time out must be after time in.</p>}
                        </div>
                      );
                    })}
                    {client?.waive_transport
                      ? <div className="space-y-1"><Label className="text-xs">Travel</Label><p className="flex h-11 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">Waived for this client</p></div>
                      : <div className="space-y-1"><Label className="text-xs">Travel</Label><TravelPicker hours={l.traveling_time_hours} onChange={(v) => setLog(i, { traveling_time_hours: v })} /></div>}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    GPS in: {l.latitude_in != null ? `${l.latitude_in.toFixed(4)}, ${l.longitude_in?.toFixed(4)}` : "—"} · out: {l.latitude_out != null ? `${l.latitude_out.toFixed(4)}, ${l.longitude_out?.toFixed(4)}` : "—"}
                  </p>
                  <TechnicianPicker count={l.technician_count} selected={l.technician_initials} users={users} disabled={readOnly} onChange={(count, initials) => setLog(i, { technician_count: count, technician_initials: initials })} />
                  <p className="mt-2 text-xs text-muted-foreground">{day.toFixed(2)} labour h · {l.technician_count} {l.technician_count === 1 ? "technician" : "technicians"}</p>
                  <div className="mt-3 space-y-1"><Label className="text-xs">Repairs done this day</Label>
                    <SuggestedTextarea rows={2} aria-label={`Repairs done day ${i + 1}`} disabled={readOnly} value={l.daily_work_description} onValueChange={daily_work_description => setLog(i, { daily_work_description })} suggestions={suggestions?.work} />
                    <VoiceDictation label="repairs done" disabled={readOnly} value={l.daily_work_description} onApply={(t) => setLog(i, { daily_work_description: t })} />
                  </div>
                  <div className="mt-3 space-y-2">
                    <Label className="text-xs">Parts used</Label>
                    {dayParts.map(({ p, j }) => (
                      <div key={j} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:grid-cols-[minmax(0,1fr)_70px_70px_110px_auto]">
                        <Input className="col-span-2 h-10 md:col-span-1" list="previous-part-descriptions" placeholder="Part description" value={p.part_description} onChange={(e) => setPart(j, { part_description: e.target.value })} />
                        <div className="grid grid-cols-3 gap-2 md:contents">
                          <Input className="h-10" list="previous-part-units" placeholder="Unit" value={p.unit} onChange={(e) => setPart(j, { unit: e.target.value })} />
                          <NumInput className="h-10" min="0" aria-label="Part quantity" placeholder="Qty" value={p.quantity} onChange={(v) => setPart(j, { quantity: v })} />
                          <NumInput className="h-10" min="0" step="0.25" aria-label="Hours acquiring this part" placeholder="Acq. h" value={p.time_acquiring_parts_hours} onChange={(v) => setPart(j, { time_acquiring_parts_hours: v })} />
                        </div>
                        <Button type="button" size="icon" variant="ghost" aria-label="Remove part" onClick={() => setParts(parts.filter((_, x) => x !== j))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {dayParts.length > 0 && <p className="text-[11px] text-muted-foreground">description · unit · qty · hours spent acquiring the part (added to labour)</p>}
                    {!readOnly && <Button type="button" size="sm" variant="ghost" onClick={() => setParts([...parts, { ...emptyPart(), log_sort_order: i }])}><Plus className="mr-1 h-4 w-4" />Add part</Button>}
                  </div>
                  <div className="mt-3 space-y-1">
                    <Label className="text-xs">Photos — damage found / parts replaced (sent to client)</Label>
                    <JobPhotos {...photoProps} scope="work" day={i} />
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
            {!readOnly && <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setLogs([...logs, { ...emptyLog(), time_in: roundTo15(nowHM()), technician_initials: staffing, technician_count: staffing.length }])}><Plus className="mr-1 h-4 w-4" />Add day</Button>}
          </div>
        </Section>

        <Section n={5} title="Internal only — never shown to client" priv>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{word("pending")}</Label>
              <p className="text-xs text-muted-foreground">Goes to the admin pending queue.</p>
              <SuggestedTextarea rows={3} aria-label="Pending works" disabled={readOnly} value={(form.pending_works_future_jobs as string) ?? ""} onValueChange={pending_works_future_jobs => set({ pending_works_future_jobs })} suggestions={suggestions?.pending} />
              <VoiceDictation label="pending works" disabled={readOnly} value={(form.pending_works_future_jobs as string) ?? ""} onApply={(t) => set({ pending_works_future_jobs: t })} />
              <JobPhotos {...photoProps} scope="pending" day={null} />
            </div>
            <div className="space-y-1.5">
              {readOnly || form.signature_data ? <JobsheetInternalNotes sheetId={sheetId} userId={profile.id} companyId={profile.company_id} initial={form.internal_comments_admin_only as string | null} initialAt={sheet.updated_at} /> : <>
              <Label>{word("internal")} (admin only)</Label>
              <p className="text-xs text-muted-foreground">For the office team. After signing, more comments are added to this same thread.</p>
              <Textarea rows={3} value={(form.internal_comments_admin_only as string) ?? ""} onChange={(e) => set({ internal_comments_admin_only: e.target.value })} />
              <VoiceDictation label="internal comments" disabled={readOnly} value={(form.internal_comments_admin_only as string) ?? ""} onApply={(t) => set({ internal_comments_admin_only: t })} />
              <InternalThread sheetId={sheetId} />
              </>}
            </div>
          </div>
        </Section>

        <SpecialNotes form={form} set={set} readOnly={readOnly} />

        <Section n={6} title="Client sign-off">
          {form.signature_data ? (
            <div className="flex flex-wrap items-center gap-4">
              <img src={form.signature_data as string} alt="Client signature" className="h-24 rounded-lg border bg-card" />
              <div className="text-sm"><p className="font-medium">{form.client_full_name as string}</p><p className="text-muted-foreground">ID {form.client_id_card_no as string}</p></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Not signed yet.</p>}
          {form.signature_data && <p className="mt-2 text-xs text-success">Signed — the PDF opens read-only, no further signature needed.</p>}
          {!readOnly && !form.signature_data && (
            <Button type="button" className="mt-4 h-11 w-full sm:w-auto" onClick={() => setSignOpen(true)}>
              <PenLine className="mr-1 h-4 w-4" />Present to client for sign-off
            </Button>
          )}
          {!form.signature_data && <DepartureRequest preapproved={client?.preapprove_departure ?? false} sheet={{ id: sheet.id, departure_status: sheet.departure_status, departure_note: sheet.departure_note, departure_reply: sheet.departure_reply, signature_data: null, return_fee_waived: sheet.return_fee_waived }} manager={manager} onChange={() => { revision.current = null; qc.invalidateQueries({ queryKey: ["sheet", sheetId] }); }} />}
        </Section>
      </fieldset>

      <Dialog open={signOpen} onOpenChange={(o) => { if (!o && handOff) return; setSignOpen(o); }}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => { if (handOff) e.preventDefault(); }}
          className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none sm:h-auto sm:max-h-[95vh] sm:max-w-3xl sm:rounded-lg">
          <DialogHeader><DialogTitle>Job sheet {sheet.jobsheet_number} — client copy</DialogTitle></DialogHeader>
          {handOff ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
              <p className="text-2xl font-semibold">Thank you!</p>
              <p className="max-w-sm text-muted-foreground">Your signature has been recorded. Please hand the device back to your technician.</p>
              <Button variant="outline" className="h-11" onClick={() => { setHandOff(false); setSignOpen(false); toast.success("Signed"); }}>Technician: back to job sheet</Button>
            </div>
          ) : (
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
              setHandOff(true);
            }}>Confirm & sign</Button>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-card/95 p-3 backdrop-blur lg:bottom-0 lg:left-[240px]">
          {savedLocally && <p className="mx-auto mb-1.5 max-w-5xl text-[11px] text-muted-foreground" aria-live="polite">Draft saved on this phone · {savedLocally.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-3">
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
            <Button className="col-span-2 h-11 sm:col-span-1" disabled={busy} onClick={submit}><Send className="mr-1 h-4 w-4" />Submit & Send Email</Button>
          </div>
        </div>
      )}
      {readOnly && isManager(profile) && <p className="mx-auto max-w-5xl text-xs text-muted-foreground">Status can be changed from the Job sheets admin page.</p>}
      <div className="mx-auto mb-28 mt-6 max-w-5xl border-t pt-4"><SheetStepper sheetId={sheetId} /></div>
      <NextStopDialog job={nextStop} profile={profile} onDone={() => { setNextStop(null); navigate({ to: "/dashboard" }); }} />
    </AppShell>
  );
}

type NextJob = { id: string; job_number: number; window_start: string | null; clients: { name: string } | null; sites: { name: string; address: string | null } | null; whatsapp: string[] };

/** Next of today's jobs for this technician that hasn't been started yet. */
async function findNextJob(userId: string, currentJobId: string | null): Promise<NextJob | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("jobs").select("id, job_number, client_id, window_start, acknowledged_at, clients(name), sites(name, address)")
    .or(assignmentFilter(userId)).eq("scheduled_date", today).is("acknowledged_at", null).order("window_start");
  const job = (data ?? []).find((j) => j.id !== currentJobId);
  if (!job) return null;
  const { data: cs } = await supabase.from("client_contacts").select("first_name, phone").eq("client_id", job.client_id).eq("has_whatsapp", true);
  return { ...job, whatsapp: (cs ?? []).map((c) => `${c.first_name} (${c.phone})`) };
}

function NextStopDialog({ job, profile, onDone }: { job: NextJob | null; profile: Profile; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const id = await createDraftSheet(profile, job.id);
      await supabase.from("job_sheets").update({ status: "in_transit", travel_start_time: new Date().toISOString() }).eq("id", id);
      await supabase.from("jobs").update({ acknowledged_at: new Date().toISOString() }).eq("id", job.id);
      toast.success(job.whatsapp.length
        ? `On the way to ${job.clients?.name}. WhatsApp message to ${job.whatsapp.join(", ")} is ready — sending starts once the WhatsApp Business account is connected.`
        : `On the way to ${job.clients?.name}. No WhatsApp contact on file for this client.`);
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onDone()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Job done — next stop</DialogTitle></DialogHeader>
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">#{job?.job_number} · {job?.clients?.name}</p>
          <p className="text-muted-foreground">{job?.sites?.name}{job?.sites?.address ? ` · ${job.sites.address}` : ""}{job?.window_start ? ` · from ${job.window_start.slice(0, 5)}` : ""}</p>
          <p className="pt-2 text-muted-foreground">{job?.whatsapp.length ? `WhatsApp contact: ${job.whatsapp.join(", ")}` : "No WhatsApp contact for this client."}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" className="h-11" onClick={onDone}>Not now</Button>
          <Button className="h-11" disabled={busy} onClick={go}><Car className="mr-1 h-4 w-4" />{job?.whatsapp.length ? "On my way — notify client" : "On my way"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
