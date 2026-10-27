import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, FileOutput, ImagePlus, PencilRuler, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useProfile } from "@/lib/profile";
import { EmptyState } from "@/components/app-shell";
import { SketchPad } from "@/components/sketch-pad";
import { ClientSitePicker } from "@/components/client-site-picker";
import {
  GEOMETRY_FIELDS,
  LOGISTICS_FIELDS,
  MODERNISATION_CHOICES,
  MODERNISATION_ITEMS,
  POWER_FIELDS,
  SURVEY_PURPOSES,
  SURVEY_STATUSES,
  dismantlingLine,
  emptyFloor,
  nextSurveyNumber,
  normalizeSurvey,
  rfqPrefillFromSurvey,
  travelFromFloors,
  type SurveyDraft,
} from "@/lib/lift-survey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STEPS = [
  { key: "header", label: "Survey & shaft" },
  { key: "geometry", label: "Geometry & pit" },
  { key: "floors", label: "Floors & doors" },
  { key: "power", label: "Machine room & power" },
  { key: "modernisation", label: "Modernisation" },
  { key: "logistics", label: "Logistics" },
  { key: "evidence", label: "Sketches & photos" },
] as const;

export function LiftSurveys() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SurveyDraft | null>(null);

  const { data = [], isPending } = useQuery({
    queryKey: ["lift-surveys"],
    queryFn: async () => {
      const r = await supabase.from("lift_surveys").select("*, clients(name), sites(name)").order("updated_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });

  const openNew = () => {
    const d = normalizeSurvey(null);
    d.conducted_at = new Date().toISOString().slice(0, 10);
    setDraft(d);
  };

  const createRfq = async (s: (typeof data)[number]) => {
    const d = normalizeSurvey(s);
    const title = `${s.survey_number || "Survey"} — ${s.sites?.name ?? s.clients?.name ?? "site"}`;
    const notes = [
      d.requires_dismantling ? dismantlingLine(d.dismantling) : "",
      s.status === "finalised" ? "From finalised site survey." : "",
    ].filter(Boolean).join("\n");
    const { error } = await supabase.from("lift_estimates").insert({
      title,
      client_id: s.client_id,
      site_id: s.site_id,
      rfq: { values: rfqPrefillFromSurvey(d), notes } as unknown as Json,
      specs: notes,
      sketch: s.sketch,
      photos: s.photos,
      events: [{ at: new Date().toISOString(), status: "draft", by: profile?.full_name ?? "" }],
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("lift_surveys").update({ status: "rfq_sent", updated_at: new Date().toISOString() }).eq("id", s.id);
    toast.success("Supplier RFQ drafted from this survey");
    await qc.invalidateQueries({ queryKey: ["lift-surveys"] });
    void navigate({ to: "/lift-rfq" });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button className="h-11 w-full sm:w-auto" onClick={openNew}><Plus className="mr-1 h-4 w-4" />New site survey</Button>
      {isPending ? <p>Loading surveys…</p> : !data.length ? (
        <EmptyState>No site surveys yet. Measure a shaft on site and it will feed your supplier RFQs automatically.</EmptyState>
      ) : data.map((s) => {
        const status = SURVEY_STATUSES.find((x) => x.key === s.status);
        return (
          <article key={s.id} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{s.survey_number || "Survey"} · {SURVEY_PURPOSES.find((p) => p.value === s.purpose)?.label ?? s.purpose}</p>
                <p className="text-sm text-muted-foreground">
                  {s.sites?.name ?? s.clients?.name ?? "No client"} · {s.survey_kind === "lift" ? "Lift" : s.survey_kind === "escalator" ? "Escalator" : "Moving walk"}
                  {s.requires_dismantling ? " · dismantling required" : s.is_bare_shaft ? " · bare shaft" : ""}
                </p>
              </div>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">{status?.label ?? s.status}</span>
            </div>
            {s.sketch && <img src={s.sketch} alt="Shaft sketch" className="h-28 rounded border bg-background object-contain" />}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setDraft(normalizeSurvey(s))}>Open</Button>
              {(s.status === "finalised" || s.status === "draft") && s.survey_kind === "lift" && (
                <Button size="sm" onClick={() => createRfq(s)}><FileOutput className="mr-1 h-4 w-4" />Create supplier RFQ</Button>
              )}
            </div>
          </article>
        );
      })}
      {draft && profile && (
        <SurveyEditor
          draft={draft}
          setDraft={setDraft}
          companyId={profile.company_id}
          existingNumbers={data.map((s) => s.survey_number ?? "")}
          onSaved={() => { setDraft(null); qc.invalidateQueries({ queryKey: ["lift-surveys"] }); }}
        />
      )}
    </div>
  );
}

function SurveyEditor({ draft, setDraft, companyId, existingNumbers, onSaved }: { draft: SurveyDraft; setDraft: (d: SurveyDraft | null) => void; companyId: string; existingNumbers: string[]; onSaved: () => void }) {
  const [step, setStep] = useState<(typeof STEPS)[number]["key"]>("header");
  const [sketching, setSketching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const d = draft;
  const set = (p: Partial<SurveyDraft>) => setDraft({ ...d, ...p });
  const setIn = (block: "geometry" | "power" | "modernisation" | "logistics", key: string, v: string) => set({ [block]: { ...d[block], [key]: v } } as Partial<SurveyDraft>);
  const setDis = (key: string, v: string) => set({ dismantling: { ...d.dismantling, [key]: v } });

  const { data: assets = [] } = useQuery({
    queryKey: ["site-assets", d.site_id],
    enabled: d.site_id !== "none",
    queryFn: async () => (await supabase.from("assets").select("id, reference_number, asset_category").eq("site_id", d.site_id).order("reference_number")).data ?? [],
  });

  useEffect(() => {
    const missing = d.photos.filter((p) => !urls[p]); if (!missing.length) return;
    supabase.storage.from("job-photos").createSignedUrls(missing, 3600).then(({ data }) => { if (data) setUrls((u) => ({ ...u, ...Object.fromEntries(data.filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl as string])) })); });
  }, [d.photos, urls]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true); const added: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${companyId}/surveys/${d.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("job-photos").upload(path, file, { contentType: file.type });
      if (error) toast.error(error.message); else added.push(path);
    }
    setBusy(false); set({ photos: [...d.photos, ...added] });
  };

  const travel = useMemo(() => travelFromFloors(d.floors), [d.floors]);

  const save = useMutation({
    mutationFn: async (finalise: boolean) => {
      const row = {
        survey_kind: d.survey_kind,
        purpose: d.purpose,
        client_id: d.client_id === "none" ? null : d.client_id,
        site_id: d.site_id === "none" ? null : d.site_id,
        asset_id: d.asset_id === "none" ? null : d.asset_id,
        is_bare_shaft: d.is_bare_shaft,
        requires_dismantling: d.requires_dismantling,
        dismantling_details: d.dismantling as unknown as Json,
        geometry: d.geometry as unknown as Json,
        floor_heights: d.floors as unknown as Json,
        power_supply: d.power as unknown as Json,
        modernisation_assessment: d.modernisation as unknown as Json,
        logistics: d.logistics as unknown as Json,
        sketch: d.sketch,
        photos: d.photos,
        conducted_at: d.conducted_at || null,
        status: finalise ? "finalised" : d.status === "draft" ? "draft" : d.status,
        updated_at: new Date().toISOString(),
      };
      const r = d.isNew
        ? await supabase.from("lift_surveys").insert({ ...row, id: d.id, company_id: companyId, survey_number: nextSurveyNumber(existingNumbers) })
        : await supabase.from("lift_surveys").update(row).eq("id", d.id);
      if (r.error) throw r.error;
    },
    onSuccess: (_v, finalise) => { toast.success(finalise ? "Survey finalised" : "Survey saved"); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save survey"),
  });

  const visibleSteps = STEPS.filter((s) => s.key !== "modernisation" || d.purpose === "modernisation" || d.purpose === "replacement");

  return (
    <Dialog open onOpenChange={(o) => !o && setDraft(null)}>
      <DialogContent className="max-h-[94dvh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{d.isNew ? "New site survey" : "Edit site survey"}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-1 border-b pb-2">
          {visibleSteps.map((s) => <Button key={s.key} type="button" size="sm" variant={step === s.key ? "default" : "ghost"} onClick={() => setStep(s.key)}>{s.label}</Button>)}
        </div>

        {step === "header" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Equipment</Label>
                <Select value={d.survey_kind} onValueChange={(v) => set({ survey_kind: v as SurveyDraft["survey_kind"] })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lift">Lift</SelectItem>
                    <SelectItem value="escalator">Escalator</SelectItem>
                    <SelectItem value="moving_walk">Moving walk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Purpose</Label>
                <Select value={d.purpose} onValueChange={(v) => set({ purpose: v as SurveyDraft["purpose"] })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{SURVEY_PURPOSES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <ClientSitePicker clientId={d.client_id === "none" ? null : d.client_id} siteId={d.site_id === "none" ? null : d.site_id} noneClientLabel="No client yet" noneSiteLabel="No site yet" onChange={(client, site) => set({ client_id: client ?? "none", site_id: site ?? "none", asset_id: "none" })} />
            {assets.length > 0 && (
              <div className="space-y-1.5">
                <Label>Existing equipment on this site (optional)</Label>
                <Select value={d.asset_id} onValueChange={(v) => set({ asset_id: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.reference_number} · {a.asset_category}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Survey date</Label>
              <Input type="date" className="h-11" value={d.conducted_at} onChange={(e) => set({ conducted_at: e.target.value })} />
            </div>
            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Shaft condition</legend>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={d.is_bare_shaft ? "default" : "outline"} onClick={() => set({ is_bare_shaft: true, requires_dismantling: false })}>Bare shaft</Button>
                <Button type="button" size="sm" variant={!d.is_bare_shaft ? "default" : "outline"} onClick={() => set({ is_bare_shaft: false })}>Existing lift installed</Button>
              </div>
              {!d.is_bare_shaft && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={d.requires_dismantling} onChange={(e) => set({ requires_dismantling: e.target.checked })} />
                  Existing lift must be dismantled & removed
                </label>
              )}
              {d.requires_dismantling && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1"><Label className="text-xs">Scope</Label><Select value={d.dismantling.scope ?? "complete"} onValueChange={(v) => setDis("scope", v)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="complete">Complete tear-out</SelectItem><SelectItem value="partial">Partial (keep some parts)</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Scrap & disposal</Label><Select value={d.dismantling.scrap ?? "company_disposes"} onValueChange={(v) => setDis("scrap", v)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company_disposes">We cart & dispose</SelectItem><SelectItem value="client_keeps">Client keeps scrap</SelectItem><SelectItem value="scrap_credit">Scrap value credited to client</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Hazardous materials (oil, asbestos)</Label><Select value={d.dismantling.hazmat ?? "unknown"} onValueChange={(v) => setDis("hazmat", v)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes — special handling</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Estimated duration (days)</Label><Input className="h-10" inputMode="numeric" value={d.dismantling.duration_days ?? ""} onChange={(e) => setDis("duration_days", e.target.value)} /></div>
                  <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Dismantling notes</Label><Textarea rows={2} value={d.dismantling.notes ?? ""} onChange={(e) => setDis("notes", e.target.value)} /></div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">Estimate line preview: {dismantlingLine(d.dismantling)}</p>
                </div>
              )}
            </fieldset>
          </div>
        )}

        {step === "geometry" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {GEOMETRY_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}{f.unit ? ` (${f.unit})` : ""}</Label>
                <Input className="h-10" inputMode={f.type === "number" ? "numeric" : undefined} value={d.geometry[f.key] ?? ""} onChange={(e) => setIn("geometry", f.key, e.target.value)} />
                {f.key === "pit_depth_mm" && Number(d.geometry[f.key]) > 0 && Number(d.geometry[f.key]) < 1000 && <p className="text-xs text-destructive">Below 1000 mm — check EN 81-20 reduced pit measures.</p>}
              </div>
            ))}
          </div>
        )}

        {step === "floors" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{d.floors.length} stops · total travel {travel ? `${travel} mm` : "—"}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => set({ floors: [...d.floors, emptyFloor(String(d.floors.length))] })}><Plus className="mr-1 h-4 w-4" />Add floor</Button>
            </div>
            {d.floors.map((f, i) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-2 sm:grid-cols-7">
                {([["floor", "Floor"], ["height_mm", "Height (mm)"], ["door_opening_mm", "Door opening (mm)"], ["wall_thickness_mm", "Wall (mm)"], ["recess_mm", "Recess (mm)"], ["door_side", "Door side"]] as const).map(([k, label]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input className="h-9" value={f[k]} onChange={(e) => set({ floors: d.floors.map((x, xi) => (xi === i ? { ...x, [k]: e.target.value } : x)) })} />
                  </div>
                ))}
                <Button type="button" size="icon" variant="ghost" aria-label="Remove floor" onClick={() => set({ floors: d.floors.filter((_, xi) => xi !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {!d.floors.length && <p className="text-sm text-muted-foreground">Add one row per stop, with the floor-to-floor height above it.</p>}
          </div>
        )}

        {step === "power" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {POWER_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input className="h-10" value={d.power[f.key] ?? ""} onChange={(e) => setIn("power", f.key, e.target.value)} />
              </div>
            ))}
          </div>
        )}

        {step === "modernisation" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">For each existing part, decide what happens to it.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODERNISATION_ITEMS.map((item) => (
                <div key={item} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                  <span className="text-sm capitalize">{item.replace("_", " ")}</span>
                  <div className="flex gap-1">
                    {MODERNISATION_CHOICES.map((c) => (
                      <Button key={c} type="button" size="sm" variant={d.modernisation[item] === c ? "default" : "outline"} onClick={() => setIn("modernisation", item, c)}>{c}</Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "logistics" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {LOGISTICS_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input className="h-10" value={d.logistics[f.key] ?? ""} onChange={(e) => setIn("logistics", f.key, e.target.value)} />
              </div>
            ))}
          </div>
        )}

        {step === "evidence" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setSketching(true)}><PencilRuler className="mr-1 h-4 w-4" />{d.sketch ? "Edit sketch" : "Sketch shaft layout"}</Button>
              <Label htmlFor="survey-camera" className="inline-flex h-10 cursor-pointer items-center rounded-md border px-3 text-sm"><Camera className="mr-1 h-4 w-4" />Camera</Label>
              <input id="survey-camera" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
              <Label htmlFor="survey-gallery" className="inline-flex h-10 cursor-pointer items-center rounded-md border px-3 text-sm"><ImagePlus className="mr-1 h-4 w-4" />Photo gallery</Label>
              <input id="survey-gallery" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </div>
            {d.sketch && <img src={d.sketch} alt="Shaft sketch" className="h-40 rounded border bg-background object-contain" />}
            {!!d.photos.length && <div className="grid grid-cols-3 gap-2">{d.photos.map((p) => <div key={p} className="relative">{urls[p] ? <img src={urls[p]} alt="Site photo" className="aspect-square w-full rounded object-cover" /> : <div className="aspect-square rounded bg-muted" />}<button type="button" aria-label="Remove photo" className="absolute right-1 top-1 rounded-full bg-background/90 p-1" onClick={() => set({ photos: d.photos.filter((x) => x !== p) })}><X className="h-3 w-3" /></button></div>)}</div>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button className="h-11" disabled={busy || save.isPending} onClick={() => save.mutate(false)}>{save.isPending ? "Saving…" : "Save draft"}</Button>
          {d.status === "draft" && <Button className="h-11" variant="secondary" disabled={busy || save.isPending} onClick={() => save.mutate(true)}>Save & finalise</Button>}
          <Button className="h-11" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
        </div>
        <SketchPad open={sketching} initial={d.sketch} onClose={() => setSketching(false)} onSave={(png) => set({ sketch: png })} />
      </DialogContent>
    </Dialog>
  );
}
