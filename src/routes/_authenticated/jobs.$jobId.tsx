import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Camera, Car, Play, CheckCircle2, WifiOff, CloudUpload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, formatDuration } from "@/lib/profile";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { CustomFieldsForm, useFieldDefs } from "@/components/custom-fields";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Job sheet — FieldOps" },
      { name: "description", content: "Work on an active job sheet: timers, photos, signature and custom fields." },
      { property: "og:title", content: "Job sheet — FieldOps" },
      { property: "og:description", content: "Active job sheet." },
    ],
  }),
  component: JobSheet,
});

type Draft = { notes: string; custom_values: Record<string, unknown>; signature_data: string | null; savedAt: number };
const draftKey = (id: string) => `job-draft:${id}`;

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

function JobSheet() {
  const { jobId } = Route.useParams();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const online = useOnline();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  const { data: job, refetch } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sheets")
        .select("*, clients(name, billing_address), assets(reference_number, asset_category, location_details, custom_attributes)")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: defs = [] } = useFieldDefs("job_sheet");
  const { data: assetDefs = [] } = useFieldDefs("asset");

  const [notes, setNotes] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!job || ready) return;
    const raw = localStorage.getItem(draftKey(jobId));
    if (raw) {
      const d = JSON.parse(raw) as Draft;
      setNotes(d.notes); setValues(d.custom_values); setSignature(d.signature_data); setHasDraft(true);
    } else {
      setNotes(job.notes ?? "");
      setValues((job.custom_values ?? {}) as Record<string, unknown>);
      setSignature(job.signature_data);
    }
    setReady(true);
  }, [job, jobId, ready]);

  // autosave draft locally
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      localStorage.setItem(draftKey(jobId), JSON.stringify({ notes, custom_values: values, signature_data: signature, savedAt: Date.now() }));
      setHasDraft(true);
    }, 600);
    return () => clearTimeout(t);
  }, [notes, values, signature, ready, jobId]);

  const { data: photos = [] } = useQuery({
    queryKey: ["job-photos", jobId, job?.photo_paths],
    enabled: !!job,
    queryFn: async () => {
      const paths = (job!.photo_paths as string[]) ?? [];
      if (!paths.length) return [];
      const { data } = await supabase.storage.from("job-photos").createSignedUrls(paths, 3600);
      return data ?? [];
    },
  });

  if (!job) return <AppShell title="Job sheet"><p className="text-muted-foreground">Loading…</p></AppShell>;

  const setStatus = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("job_sheets").update(patch).eq("id", jobId);
    if (error) return toast.error(error.message);
    refetch();
    qc.invalidateQueries({ queryKey: ["my-jobs-full"] });
  };

  const sync = async () => {
    if (!online) return toast.info("You're offline — your draft is saved on this device.");
    const { error } = await supabase.from("job_sheets").update({ notes, custom_values: values as never, signature_data: signature }).eq("id", jobId);
    if (error) return toast.error(error.message);
    localStorage.removeItem(draftKey(jobId));
    setHasDraft(false);
    refetch();
    toast.success("Job sheet saved");
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || !profile) return;
    const paths = [...((job.photo_paths as string[]) ?? [])];
    for (const f of Array.from(files)) {
      const path = `${profile.company_id}/${jobId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("job-photos").upload(path, f);
      if (error) { toast.error(error.message); continue; }
      paths.push(path);
    }
    await setStatus({ photo_paths: paths });
    toast.success("Photos uploaded");
  };

  const now = () => new Date().toISOString();
  const elapsed = (a?: string | null, b?: string | null) => (a ? formatDuration((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) : "—");
  const attrs = (job.assets?.custom_attributes ?? {}) as Record<string, unknown>;

  return (
    <AppShell
      title={job.clients?.name ?? "Job sheet"}
      actions={<Button asChild variant="ghost" size="sm"><Link to="/jobs"><ArrowLeft className="mr-1 h-4 w-4" />Jobs</Link></Button>}
    >
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium text-foreground">Asset</h2>
              <StatusBadge status={job.status} />
            </div>
            {job.assets ? (
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Reference</dt><dd className="text-foreground">{job.assets.reference_number}</dd>
                <dt className="text-muted-foreground">Category</dt><dd className="text-foreground">{job.assets.asset_category}</dd>
                <dt className="text-muted-foreground">Location</dt><dd className="text-foreground">{job.assets.location_details || job.clients?.billing_address || "—"}</dd>
                {assetDefs.filter((d) => attrs[d.id] !== undefined).map((d) => (
                  <><dt key={d.id + "t"} className="text-muted-foreground">{d.field_label}</dt><dd key={d.id} className="text-foreground">{String(attrs[d.id])}</dd></>
                ))}
              </dl>
            ) : <p className="mt-2 text-sm text-muted-foreground">No asset linked to this job.</p>}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-medium text-foreground">Timers</h2>
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div><p>Travel</p><p className="font-display text-lg tabular-nums text-foreground">{elapsed(job.travel_start_time, job.work_start_time ?? job.work_end_time)}</p></div>
              <div><p>Work</p><p className="font-display text-lg tabular-nums text-foreground">{elapsed(job.work_start_time, job.work_end_time)}</p></div>
              <div><p>Finished</p><p className="font-display text-lg text-foreground">{job.work_end_time ? new Date(job.work_end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p></div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Button size="lg" variant="outline" className="h-12" disabled={job.status !== "pending"} onClick={() => setStatus({ status: "in_transit", travel_start_time: now() })}>
                <Car className="mr-2 h-4 w-4" />Start travel
              </Button>
              <Button size="lg" className="h-12" disabled={job.status === "in_progress" || job.status === "completed"} onClick={() => setStatus({ status: "in_progress", work_start_time: now() })}>
                <Play className="mr-2 h-4 w-4" />Start work
              </Button>
              <Button size="lg" variant="secondary" className="h-12" disabled={job.status !== "in_progress"} onClick={() => setStatus({ status: "completed", work_end_time: now() })}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Finish
              </Button>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-medium text-foreground">Photos</h2>
            <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-accent">
              <Camera className="h-6 w-6" /> {online ? "Take or upload photos" : "Photos need a connection"}
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" disabled={!online} onChange={(e) => upload(e.target.files)} />
            </label>
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {photos.map((p) => p.signedUrl && <img key={p.path} src={p.signedUrl} alt="Job photo" className="aspect-square w-full rounded-md object-cover" />)}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-medium text-foreground">Job details</h2>
            <CustomFieldsForm defs={defs} values={values} onChange={setValues} />
            <div className="mt-4 space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Work carried out, parts used…" />
            </div>
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-medium text-foreground">Customer signature</h2>
            {ready && <SignaturePad value={signature} onChange={setSignature} />}
          </section>
          <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-lg lg:bottom-4">
            <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              {!online && <WifiOff className="h-4 w-4 shrink-0 text-destructive" />}
              <span className="truncate">{!online ? "Offline — draft saved on this device" : hasDraft ? "Unsaved draft on this device" : "All changes saved"}</span>
            </p>
            <Button onClick={sync} className="h-11 shrink-0"><CloudUpload className="mr-2 h-4 w-4" />Save</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
