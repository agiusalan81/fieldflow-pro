import { PendingPhotoStrip } from "@/components/pending-photo-strip";
import { EquipmentProblemQueue } from "@/components/equipment-problem-queue";
import { InternalThread } from "@/components/jobsheet-internal-notes";
import { Textarea } from "@/components/ui/textarea";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, CheckCircle2, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers, isManager } from "@/lib/profile";
import { parsePhotos } from "@/lib/jobsheets";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pending-works")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Pending works — FieldBridge" },
      { name: "description", content: "Follow-up repairs flagged by technicians, ready to schedule or estimate." },
      { property: "og:title", content: "Pending works — FieldBridge" },
      { property: "og:description", content: "Follow-up repairs ready to schedule or estimate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendingWorks,
});

const STATUS: Record<string, string> = { open: "Open", quote: "Awaiting estimate", dispatch: "Dispatch queue", supervisor: "Supervisor review", awaiting_parts: "Awaiting parts", scheduled: "Scheduled", done: "Done" };

export function usePendingWorks() {
  return useQuery({
    queryKey: ["pending-works"],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_sheets")
        .select("id, jobsheet_number, client_id, site_id, asset_id, pending_works_future_jobs, pending_status, photo_paths, updated_at, reported_fault, repairs_performed, internal_comments_admin_only, lift_model, serial_number, clients(name), sites(name), assets(reference_number), users!job_sheets_assigned_technician_id_fkey(full_name)")
        .not("pending_works_future_jobs", "is", null).neq("pending_works_future_jobs", "").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function PendingWorks() {
  const { data: profile } = useProfile();
  const { data = [] } = usePendingWorks();
  const { data: users = [] } = useCompanyUsers();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [routeTo, setRouteTo] = useState<{row:(typeof data)[number];action:string}|null>(null);
  const [assignee,setAssignee]=useState("");
  const [note,setNote]=useState("");
  const [filter, setFilter] = useState("active");
  const [sched, setSched] = useState<(typeof data)[number] | null>(null);
  const [review, setReview] = useState<(typeof data)[number] | null>(null);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), tech: "none" });
  const rows = data.filter((r) => filter === "all" || (filter === "active" ? r.pending_status !== "done" : r.pending_status === filter));
  const setStatus = async (id: string, action: string, target: string | null = null, date: string | null = null, reason = "") => {
    const row = data.find(r=>r.id===id); if(!row || busy)return false;
    setBusy(true);
    const r = await supabase.rpc("route_pending_work", {_sheet:id,_action:action,_expected:row.pending_status,...(target?{_assignee:target}:{}),...(date?{_date:date}:{}),_note:reason});
    setBusy(false); if(r.error){toast.error(r.error.message);return false;}
    await Promise.all([qc.invalidateQueries({queryKey:["pending-works"]}),qc.invalidateQueries({queryKey:["jobs"]}),qc.invalidateQueries({queryKey:["attention-overview"]})]);toast.success("Follow-up action saved");return true;
  };
  const schedule = async () => {
    if (!sched || !profile) return;
    if(await setStatus(sched.id,"scheduled",f.tech==="none"?null:f.tech,f.date)){setSched(null);toast.success("Return visit scheduled");}
  };
  if(!isManager(profile))return <AppShell title="Pending works"><EmptyState>Pending Works actions are available to supervisors and office staff.</EmptyState></AppShell>;
  return (
    <AppShell title="Pending works">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {["active", "open", "quote", "dispatch", "supervisor", "awaiting_parts", "scheduled", "done", "all"].map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>{s === "active" ? "Not done" : s === "all" ? "All" : STATUS[s]}</Button>
          ))}
        </div>
        <EquipmentProblemQueue/>
        {!rows.length ? <EmptyState>No pending works here.</EmptyState> : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const photos = parsePhotos(r.photo_paths).filter((p) => p.scope === "pending").length;
              return (
                <li key={r.id} className="cursor-pointer rounded-xl border bg-card p-4" onClick={() => navigate({ to: "/sheets/$sheetId", params: { sheetId: r.id } })}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">#{r.jobsheet_number} · {r.users?.full_name ?? "—"} · {new Date(r.updated_at).toLocaleDateString()}{photos ? ` · ${photos} photo${photos > 1 ? "s" : ""}` : ""}</p>
                      <p className="truncate font-medium text-foreground">{r.clients?.name}{r.sites?.name ? ` · ${r.sites.name}` : ""}{r.assets?.reference_number ? ` · ${r.assets.reference_number}` : ""}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{STATUS[r.pending_status] ?? r.pending_status}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground">{r.pending_works_future_jobs}</p>
                  <PendingPhotoStrip sheetId={r.id} photos={r.photo_paths} onOpen={()=>setReview(r)}/>
                  <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {r.pending_status !== "scheduled" && r.pending_status !== "done" && <Button size="sm" onClick={() => setSched(r)}><CalendarPlus className="mr-1 h-4 w-4" />Schedule visit</Button>}
                    {r.pending_status !== "done" && <Button size="sm" variant="outline" onClick={() => setReview(r)}><Receipt className="mr-1 h-4 w-4" />Review for estimate</Button>}
                    {r.pending_status !== "done" && <>{([["dispatch","Dispatch"],["supervisor","Supervisor review"],["awaiting_parts","Awaiting parts"],["done","Close"]] as const).map(([action,label])=><Button key={action} size="sm" variant="outline" disabled={busy} onClick={()=>{setRouteTo({row:r,action});setAssignee("");setNote("");}}>{label}</Button>)}</>}
                    <Button size="sm" variant="ghost" onClick={()=>navigate({to:"/sheets/$sheetId",params:{sheetId:r.id}})}>Original sheet</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mx-auto mt-4 max-w-5xl text-xs text-muted-foreground">Scheduled items close automatically when the follow-up job sheet is submitted.</p>
      <Dialog open={!!routeTo} onOpenChange={o=>!o&&!busy&&setRouteTo(null)}><DialogContent><DialogHeader><DialogTitle>{routeTo ? STATUS[routeTo.action] : "Follow-up"}</DialogTitle></DialogHeader><p className="text-sm">#{routeTo?.row.jobsheet_number} · {routeTo?.row.clients?.name}</p><p className="text-sm text-muted-foreground">{routeTo?.row.pending_works_future_jobs}</p>{routeTo?.action==="supervisor"&&<><Label htmlFor="pending-supervisor">Supervisor</Label><select id="pending-supervisor" className="h-10 rounded-md border bg-background px-2" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Choose supervisor</option>{users.filter(u=>["supervisor","admin","superuser"].includes(u.role)).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></>}<Label htmlFor="pending-action-note">{routeTo?.action==="done"?"Closure reason":"Action note"}</Label><Textarea id="pending-action-note" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/><p className="text-xs text-muted-foreground">The signed original stays unchanged. {routeTo?.action==="dispatch"?"An unassigned follow-up job is created for dispatch.":""}</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setRouteTo(null)}>Cancel</Button><Button disabled={busy||(routeTo?.action==="supervisor"&&!assignee)||(routeTo?.action==="done"&&!note.trim())} onClick={async()=>{if(routeTo&&await setStatus(routeTo.row.id,routeTo.action,assignee||null,null,note.trim()))setRouteTo(null);}}>Confirm action</Button></div></DialogContent></Dialog>
      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Review for estimate — #{review?.jobsheet_number}</DialogTitle></DialogHeader>
          {review && <ReviewBody r={review} />}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-11" onClick={() => review && navigate({ to: "/sheets/$sheetId", params: { sheetId: review.id } })}>Open full job sheet</Button>
            <Button variant="outline" className="h-11" onClick={async () => { if (review) { if(await setStatus(review.id, "quote")) setReview(null); } }}><Receipt className="mr-1 h-4 w-4" />Mark needs estimate</Button>
            <Button className="h-11 sm:col-span-2" onClick={async () => { if (!review) return; const id = review.id; if (review.pending_status === "quote" || await setStatus(id, "quote")) { setReview(null); void navigate({ to: "/estimates", search: { fromSheet: id } }); } }}><Receipt className="mr-1 h-4 w-4" />Make estimate</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!sched} onOpenChange={(o) => !o && setSched(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule return visit</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{sched?.clients?.name} · {sched?.pending_works_future_jobs}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Date</Label><Input className="h-11" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Technician</Label>
              <Select value={f.tech} onValueChange={(v) => setF({ ...f, tech: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Unassigned</SelectItem>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <Button disabled={busy||!f.date} className="h-11" onClick={schedule}>Create job</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ReviewBody({ r }: { r: NonNullable<ReturnType<typeof usePendingWorks>["data"]>[number] }) {
  const photos = parsePhotos(r.photo_paths).filter((p) => p.scope === "pending");
  const [urls, setUrls] = useState<string[] | null>(null);
  useEffect(() => {
    if (!photos.length) { setUrls([]); return; }
    supabase.storage.from("job-photos").createSignedUrls(photos.map((p) => p.path), 600).then(({ data }) => setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);
  const row = (l: string, v: string | null | undefined) => v ? <div><p className="text-xs text-muted-foreground">{l}</p><p className="whitespace-pre-line text-sm text-foreground">{v}</p></div> : null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">{r.clients?.name}{r.sites?.name ? ` · ${r.sites.name}` : ""}{r.assets?.reference_number ? ` · ${r.assets.reference_number}` : ""}</p>
      <div className="grid gap-3 sm:grid-cols-2">{row("Model", r.lift_model)}{row("Serial number", r.serial_number)}</div>
      {row("Reported fault", r.reported_fault)}
      {row("Work done on this visit", r.repairs_performed)}
      <div className="rounded-lg border bg-muted/40 p-3">{row("Pending works (from technician)", r.pending_works_future_jobs)}</div>
      <div><p className="text-xs text-muted-foreground">Internal comments</p><InternalThread sheetId={r.id} initial={r.internal_comments_admin_only} /></div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Pending works photos ({photos.length})</p>
        {urls === null ? <p className="text-sm text-muted-foreground">Loading…</p> : urls.length ? (
          <div className="grid grid-cols-3 gap-2">{urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Pending works" className="aspect-square w-full rounded-md object-cover" /></a>)}</div>
        ) : <p className="text-sm text-muted-foreground">No photos.</p>}
      </div>
    </div>
  );
}
