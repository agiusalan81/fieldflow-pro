import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { saveSheetOrder } from "@/lib/sheet-nav";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Mail, FileText, Trash2, Download, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { DateFilter } from "@/components/date-filter";
import { MonthlySheets } from "@/components/monthly-sheets";
import { BillingReview } from "@/components/billing-review";
import { useCan } from "@/lib/permissions";
import { SearchSelect } from "@/components/search-select";
import { sendJobSheetEmail, combinedJobSheets } from "@/lib/sendJobSheetEmail";
import { Checkbox } from "@/components/ui/checkbox";
import { EVENTS, parseIntegrations, renderTemplate } from "@/lib/integrations";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers, initialsOf } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { dispatchTeamSize, skillMatchScore } from "@/lib/skills";
import { NumInput } from "@/components/num-input";
import { useEntrySuggestions } from "@/hooks/use-entry-suggestions";
import { SuggestedTextarea } from "@/components/suggested-textarea";
import { matchesSheetFilter, matchesSheetDetails, validateCombinedSheets } from "@/lib/jobsheets";
import { matchesSheetSearch } from "@/lib/dwr";
import { AppShell, EmptyState } from "@/components/app-shell";
import { useFieldDefs, renderCustomValues } from "@/components/custom-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/jobs")({
  validateSearch: (s: Record<string, unknown>): { new?: boolean | undefined } => ({ new: s["new"] === true || s["new"] === "true" ? true : undefined }),
  head: () => ({
    meta: [
      { title: "Job sheets — FieldBridge" },
      { name: "description", content: "Master control of all job sheets: hours, overtime and status." },
      { property: "og:title", content: "Job sheets — FieldBridge" },
      { property: "og:description", content: "Master job sheet control." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminJobs,
});

const STATUSES = [["draft", "Draft"], ["pending", "Pending"], ["in_transit", "In transit"], ["in_progress", "In progress"], ["completed", "Completed"]] as const;

const QUEUE_FILTERS = [["admin_queue", "In admin queue"], ["needs_approval", "Needs asset approval"], ["has_pending", "Has pending works"]] as const;

function AdminJobs() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: defs = [] } = useFieldDefs("job_sheet");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [details, setDetails] = useState({ from: "", to: "", client: "all", technician: "all" });
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkEmail, setBulkEmail] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const combine = useServerFn(combinedJobSheets);
  const { data: staff = [] } = useCompanyUsers();
  const { data: customers = [] } = useQuery({ queryKey: ["clients"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  useEffect(() => { setSelected([]); }, [filter, q, mine, details]);
  const { data: me } = useProfile();
  const can = useCan(me);
  const [review, setReview] = useState<string | null>(null);
  const listRef = useRef<string[]>([]);
  const [approving, setApproving] = useState<(typeof jobs)[number] | null>(null);
  const { data: jobs = [] } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sheets")
        .select("*, clients(name), sites(name, address), assets(id, reference_number, asset_category, serial_number, custom_attributes), users!job_sheets_assigned_technician_id_fkey(full_name), jobsheet_time_logs(daily_total_hours, traveling_time_hours, technician_initials)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("job_sheets").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["admin-jobs"] });
    return true;
  };
  const [resend, setResend] = useState<{ id: string; client_id: string; site_id: string | null; jobsheet_number: string } | null>(null);
  const superuser = me?.real_role === "superuser";
  const [deleting, setDeleting] = useState<{ id: string; jobsheet_number: string; status: string } | null>(null);
  const confirmDelete = async () => {
    if (!deleting) return;
    const { error, count } = await supabase.from("job_sheets").delete({ count: "exact" }).eq("id", deleting.id);
    if (error || !count) { toast.error(error?.message ?? "Not allowed to delete this sheet"); return; }
    toast.success(`Job sheet- ${deleting.jobsheet_number} deleted`);
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-jobs"] });
  };
  const open = (id: string) => { saveSheetOrder(listRef.current); return navigate({ to: "/sheets/$sheetId", params: { sheetId: id } }); };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const confirmApprove = async () => {
    const j = approving;
    if (!j) return;
    if (j.assets?.id) {
      const attrs = { ...((j.assets.custom_attributes ?? {}) as Record<string, unknown>) };
      if (j.lift_model) attrs["model"] = j.lift_model;
      const { error } = await supabase.from("assets").update({
        custom_attributes: attrs as never,
        ...(j.serial_number ? { serial_number: j.serial_number } : {}),
      }).eq("id", j.assets.id);
      if (error) { toast.error(error.message); return; }
    }
    if (await update(j.id, { requires_admin_approval: false })) {
      toast.success(`Asset ${j.assets?.reference_number ?? ""} approved`);
      qc.invalidateQueries({ queryKey: ["assets-all"] });
      setApproving(null);
    }
  };

  const queue = jobs.filter((j) => matchesSheetFilter(j, "admin_queue"));
  const base = jobs.filter((j) => matchesSheetDetails(j, { ...details, initials: staff.find((u) => u.id === details.technician) ? initialsOf(staff.find((u) => u.id === details.technician) ?? { full_name: "" }) : undefined }) && (!mine || j.assigned_technician_id === me?.id) && matchesSheetSearch(j.jobsheet_number, [j.clients?.name, j.users?.full_name, j.assets?.reference_number, j.sites?.name, j.reported_fault], q));
  const list = base.filter((j) => matchesSheetFilter(j, filter));
  listRef.current = list.map((j) => j.id);
  const pills: (readonly [string, string])[] = [["all", "All"], ...STATUSES, ["has_pending", "Pending works"]];
  const countFor = (k: string) => base.filter((j) => matchesSheetFilter(j, k)).length;
  const totalHours = (j: (typeof jobs)[number]) => (j.jobsheet_time_logs ?? []).reduce((s, l) => s + Number(l.daily_total_hours || 0), 0);

  const office = me?.role === "admin" || me?.role === "superuser";
  const selectedSheets = jobs.filter((j) => selected.includes(j.id));
  const selectable = list.filter((j) => j.status === "completed");
  const toggleSheet = (id: string, on: boolean) => setSelected((old) => on ? [...new Set([...old, id])] : old.filter((x) => x !== id));
  const download = async () => {
    try {
      validateCombinedSheets(selectedSheets); setBulkBusy(true);
      const r = await combine({ data: { sheetIds: selected } });
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = r.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "PDF could not be generated"); }
    finally { setBulkBusy(false); }
  };

  return (
    <AppShell title="Job sheets" actions={<NewJobDialog />}>
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <Input placeholder="Search client, technician, asset or sheet no." value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectGroup><SelectLabel>Status</SelectLabel>{STATUSES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectGroup>
            <SelectGroup><SelectLabel>Needs attention</SelectLabel>{QUEUE_FILTERS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><Label>Created from</Label><DateFilter label="From date" value={details.from} onChange={(from) => setDetails({ ...details, from })} /></div>
        <div className="space-y-1"><Label>Created to</Label><DateFilter label="To date" value={details.to} onChange={(to) => setDetails({ ...details, to })} /></div>
        <div className="space-y-1"><Label>Customer</Label><SearchSelect value={details.client} options={[{ value: "all", label: "All customers" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} onChange={(client) => setDetails({ ...details, client })} /></div>
        <div className="space-y-1"><Label>Technician</Label><SearchSelect value={details.technician} options={[{ value: "all", label: "All technicians" }, ...staff.map((u) => ({ value: u.id, label: u.full_name, hint: initialsOf(u) }))]} onChange={(technician) => setDetails({ ...details, technician })} /></div>
      </div>
      {details.from && details.to && details.from > details.to && <p className="mb-3 text-sm text-destructive">End date must be on or after start date.</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={mine ? "outline" : "default"} onClick={() => setMine(false)}>All sheets</Button>
        <Button size="sm" variant={mine ? "default" : "outline"} onClick={() => setMine(true)}>Assigned to me</Button>
        <Button size="sm" variant="ghost" onClick={() => { setDetails({ from: "", to: "", client: "all", technician: "all" }); setFilter("all"); setQ(""); setMine(false); }}>Clear filters</Button>
        <span className="self-center text-sm text-muted-foreground">{list.length} sheets</span>
      </div>
      {office && selected.length > 0 && <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 border border-primary bg-background p-3">
        <span className="mr-auto text-sm font-medium">{selected.length} selected</span>
        <Button size="sm" variant="outline" disabled={bulkBusy} onClick={download}><Download className="mr-1 h-4 w-4" />{bulkBusy ? "Preparing…" : "Download combined PDF"}</Button>
        <Button size="sm" disabled={bulkBusy} onClick={() => { try { validateCombinedSheets(selectedSheets); setBulkEmail(true); } catch (e) { toast.error(e instanceof Error ? e.message : "Check selection"); } }}><Mail className="mr-1 h-4 w-4" />Email combined PDF</Button>
        <Button size="icon" variant="ghost" aria-label="Clear selection" onClick={() => setSelected([])}><X className="h-4 w-4" /></Button>
      </div>}
      <MonthlySheets sheets={list} office={office} />
      {queue.length > 0 && (
        <section className="mb-4 rounded-xl border border-warning/50 bg-warning/10 p-4">
          <h2 className="mb-2 font-medium text-foreground">Admin pending queue ({queue.length})</h2>
          <ul className="space-y-2">
            {queue.map((j) => (
              <li key={j.id} onClick={() => open(j.id)} className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-card p-3 text-sm transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate font-medium"><span className="font-mono text-primary">#{j.jobsheet_number}</span> {j.clients?.name} · {j.users?.full_name ?? "—"}</p>
                  {j.requires_admin_approval && <p className="truncate text-xs text-muted-foreground">Asset changed: model {j.lift_model || "—"}, serial {j.serial_number || "—"}</p>}
                  {j.pending_works_future_jobs?.trim() && <p className="truncate text-xs text-muted-foreground">Pending works: {j.pending_works_future_jobs}</p>}
                </div>
                <div className="flex gap-1" onClick={stop}>
                  {j.requires_admin_approval && <Button size="sm" onClick={() => setApproving(j)}>Approve asset</Button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {pills.map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} aria-pressed={filter === k} onClick={() => setFilter(k)} className="rounded-full">
            {l} <span className="ml-1 tabular-nums opacity-80">({countFor(k)})</span>
          </Button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState>No job sheets match.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {office && <TableHead className="w-10"><Checkbox aria-label="Select all visible completed job sheets" checked={selectable.length > 0 && selectable.every((j) => selected.includes(j.id)) ? true : selectable.some((j) => selected.includes(j.id)) ? "indeterminate" : false} onCheckedChange={(on) => setSelected(on ? selectable.map((j) => j.id) : [])} /></TableHead>}
                <TableHead>Client / asset</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead className="text-right">Total h</TableHead>
                <TableHead className="min-w-56">Custom fields</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((j) => {
                const cv = renderCustomValues(defs, j.custom_values);
                return (
                  <TableRow key={j.id} onClick={() => open(j.id)} data-state={selected.includes(j.id) ? "selected" : undefined} className="cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-primary/10">
                    {office && <TableCell onClick={stop}><Checkbox aria-label={`Select job sheet ${j.jobsheet_number}`} checked={selected.includes(j.id)} disabled={j.status !== "completed"} onCheckedChange={(on) => toggleSheet(j.id, !!on)} /></TableCell>}
                    <TableCell>
                      <p className="font-medium text-foreground"><span className="font-mono text-primary">#{j.jobsheet_number}</span> {j.clients?.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {j.requires_admin_approval && <span className="rounded bg-warning/25 px-1.5 text-[10px] text-warning-foreground">Asset edit needs approval</span>}
                        {j.pending_works_future_jobs?.trim() && <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">Pending works</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{j.assets?.reference_number ?? "—"} · {new Date(j.created_at).toLocaleDateString()}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{j.users?.full_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{totalHours(j).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cv.length ? cv.join(" · ") : "—"}</TableCell>
                    <TableCell onClick={stop}>
                      <Select value={j.status} onValueChange={(v) => update(j.id, { status: v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={stop}>
                      <div className="flex gap-2">
                        {j.status === "completed" && <>
                          {office && can("billing") && <Button size="sm" variant="outline" onClick={() => setReview(j.id)}>Review billing</Button>}
                          <Button asChild size="sm" variant="outline"><Link to="/print/$sheetId" params={{ sheetId: j.id }} target="_blank"><FileText className="mr-1 h-4 w-4" />Client PDF</Link></Button>
                          <Button size="sm" onClick={() => setResend(j)}><Mail className="mr-1 h-4 w-4" />Resend</Button>
                        </>}
                        {superuser && <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Delete job sheet ${j.jobsheet_number}`} onClick={() => setDeleting(j)}><Trash2 className="h-4 w-4" /></Button>}
                        {j.status !== "completed" && !superuser && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve asset changes</DialogTitle></DialogHeader>
          {approving && (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Job sheet</dt><dd className="font-mono">#{approving.jobsheet_number}</dd>
                <dt className="text-muted-foreground">Client</dt><dd>{approving.clients?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Site</dt><dd>{approving.sites?.name ?? "—"}{approving.sites?.address ? ` · ${approving.sites.address}` : ""}</dd>
                <dt className="text-muted-foreground">Equipment</dt><dd>{approving.assets ? `${approving.assets.reference_number} · ${approving.assets.asset_category}` : "No linked equipment"}</dd>
              </dl>
              <div className="rounded-lg border">
                <div className="grid grid-cols-3 border-b bg-muted/50 px-3 py-1.5 text-xs font-medium"><span /><span>Current</span><span>Proposed</span></div>
                <div className="grid grid-cols-3 px-3 py-1.5"><span className="text-muted-foreground">Model</span><span>{String(((approving.assets?.custom_attributes ?? {}) as Record<string, unknown>)["model"] ?? "—")}</span><span className="font-medium">{approving.lift_model || "—"}</span></div>
                <div className="grid grid-cols-3 px-3 py-1.5"><span className="text-muted-foreground">Serial</span><span>{approving.assets?.serial_number ?? "—"}</span><span className="font-medium">{approving.serial_number || "—"}</span></div>
              </div>
              {!approving.assets && <p className="text-xs text-muted-foreground">No equipment is linked, so only the approval flag will be cleared.</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button onClick={confirmApprove}>Confirm &amp; approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {bulkEmail && selectedSheets[0] && <ResendDialog sheet={selectedSheets[0]} sheetIds={selected} onClose={() => setBulkEmail(false)} />}
      {resend && <ResendDialog sheet={resend} onClose={() => setResend(null)} />}
      {office && can("billing") && <BillingReview sheetId={review} onClose={() => setReview(null)} />}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Job sheet- {deleting?.jobsheet_number}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This permanently removes the sheet, its time logs, parts and photos records. {deleting?.status === "completed" ? "It is completed and may already be signed by the client." : ""} This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function NewJobDialog() {
  const { data: profile } = useProfile();
  const { data: suggestions } = useEntrySuggestions();
  const { data: allUsers = [] } = useCompanyUsers();
  // Field crew are supervisors and technicians only; office staff dispatch but are not crew.
  const users = allUsers.filter(u => u.role === "technician" || u.role === "supervisor");
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [open, setOpenRaw] = useState(!!search.new);
  const setOpen = (o: boolean) => { setOpenRaw(o); if (!o && search.new) navigate({ to: "/admin/jobs", search: {}, replace: true }); };
  const empty = { client_id: "", site_id: "none", asset_id: "none", tech: "none", assistant: "none", scheduled_date: new Date().toISOString().slice(0, 10), window_start: "", window_end: "", priority: "normal", problem_summary: "", teamSize: 1, open: false, skills: [] as string[], crew: [] as string[] };
  const [f, setF] = useState(empty);
  const feature = usePlanFeatures(!!profile);
  const smart = feature("skills_dispatch");
  const { data: skillList = [] } = useQuery({ queryKey: ["company-skills"], enabled: smart, queryFn: async () => (await supabase.from("company_skills").select("id,name,category,archived").order("name")).data ?? [] });
  const { data: memberSkills = [] } = useQuery({ queryKey: ["member-skills"], enabled: smart, queryFn: async () => (await supabase.from("member_skills").select("user_id,skill_id")).data ?? [] });
  const skillsOf = (u: string) => memberSkills.filter(m => m.user_id === u).map(m => m.skill_id);
  const ranked = smart && f.skills.length ? [...users].sort((a, b) => skillMatchScore(skillsOf(b.id), f.skills) - skillMatchScore(skillsOf(a.id), f.skills)) : users;
  const label = (u: { id: string; full_name: string }) => smart && f.skills.length ? `${u.full_name} · ${skillMatchScore(skillsOf(u.id), f.skills)}/${f.skills.length} skills` : u.full_name;
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: async () => (await supabase.from("sites").select("id, client_id, name").order("name")).data ?? [] });
  const { data: assets = [] } = useQuery({ queryKey: ["assets-all"], queryFn: async () => (await supabase.from("assets").select("id, client_id, site_id, reference_number, asset_category")).data ?? [] });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !f.client_id) { toast.error("Pick a client"); return; }
    const named = [f.tech, f.assistant].filter(x => x !== "none").length + f.crew.length;
    const teamSize = dispatchTeamSize(f.teamSize, smart, named);
    if (named > teamSize) { toast.error(`You picked ${named} people for a team of ${teamSize}`); return; }
    if (!f.open && f.tech === "none" && f.crew.length) { toast.error("Choose a lead technician"); return; }
    const { data: job, error } = await supabase.from("jobs").insert({
      company_id: profile.company_id, client_id: f.client_id,
      site_id: f.site_id === "none" ? null : f.site_id, asset_id: f.asset_id === "none" ? null : f.asset_id,
      assigned_technician_id: f.tech === "none" ? null : f.tech, secondary_technician_id: f.assistant === "none" ? null : f.assistant, scheduled_date: f.scheduled_date,
      window_start: f.window_start || null, window_end: f.window_end || null, priority: f.priority, problem_summary: f.problem_summary || null,
      required_team_size: teamSize,
      ...(smart ? { open_to_claim: f.open && named < teamSize } : {}),
    }).select("id, job_number").single();
    if (error) { toast.error(error.message); return; }
    if (smart && job) {
      if (f.skills.length) { const r = await supabase.from("job_skills").insert(f.skills.map(skill_id => ({ job_id: job.id, skill_id, company_id: profile.company_id, mandatory: true }))); if (r.error) toast.error(r.error.message); }
      if (f.crew.length) { const r = await supabase.from("job_crew").insert(f.crew.map(user_id => ({ job_id: job.id, user_id, company_id: profile.company_id }))); if (r.error) toast.error(r.error.message); }
    }
    if (f.priority === "urgent" && f.tech !== "none") {
      const { data: cs } = await supabase.from("company_settings").select("integrations").eq("company_id", profile.company_id).maybeSingle();
      const t = parseIntegrations(cs?.integrations).templates.emergency_dispatch;
      if (t.enabled) {
        const site = sites.find((x) => x.id === f.site_id);
        await supabase.from("internal_messages").insert([f.tech, f.assistant].filter(id => id !== "none").map(receiver_id => ({ company_id: profile.company_id, sender_id: profile.id, receiver_id,
          message_text: "EMERGENCY: " + renderTemplate(t.body || EVENTS[2].body, { job_number: String(job?.job_number ?? ""), site_address: site?.name ?? "", site_name: site?.name ?? "", priority: "urgent", client_name: clients.find((c) => c.id === f.client_id)?.name ?? "" }) })));
        toast.success("Emergency sent to the assigned technicians' Team Chats");
      }
    }
    toast.success("Visit scheduled");
    setOpen(false); setF(empty);
    qc.invalidateQueries({ queryKey: ["schedule"] });
    qc.invalidateQueries({ queryKey: ["today-jobs"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Schedule visit</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Schedule a visit</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v, site_id: "none", asset_id: "none" })}>
            <SelectTrigger><SelectValue placeholder={clients.length ? "Client" : "Add a client first"} /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={f.site_id} onValueChange={(v) => setF({ ...f, site_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No site</SelectItem>{sites.filter((s) => s.client_id === f.client_id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.asset_id} onValueChange={(v) => setF({ ...f, asset_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No lift</SelectItem>{assets.filter((a) => a.client_id === f.client_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.reference_number} · {a.asset_category}</SelectItem>)}</SelectContent>
            </Select>
            <div className="space-y-1"><Label>Lead technician</Label><Select value={f.tech} onValueChange={(v) => setF({ ...f, tech: v, assistant: v === f.assistant || v === "none" ? "none" : f.assistant, crew: f.crew.filter(c => c !== v) })}>
              <SelectTrigger aria-label="Lead technician"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">{smart && f.open ? "First to claim" : "Unassigned"}</SelectItem>{ranked.map((u) => <SelectItem key={u.id} value={u.id}>{label(u)}</SelectItem>)}</SelectContent>
            </Select>
            </div>
            <div className="space-y-1"><Label>Assisting technician</Label><Select value={f.assistant} disabled={f.tech === "none"} onValueChange={assistant => setF({ ...f, assistant, crew: f.crew.filter(c => c !== assistant) })}>
              <SelectTrigger aria-label="Assisting technician"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No assistant</SelectItem>{ranked.filter(u => u.id !== f.tech).map(u => <SelectItem key={u.id} value={u.id}>{label(u)}</SelectItem>)}</SelectContent>
            </Select></div>
            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["low", "normal", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {smart && <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Smart dispatch</p>
            <div className="space-y-1"><Label htmlFor="team-size">Required team size</Label><NumInput id="team-size" className="h-11 w-28" min={1} max={30} step={1} value={f.teamSize} onChange={teamSize => setF({ ...f, teamSize })} /></div>
            {!!skillList.filter(s => !s.archived).length && <div className="space-y-1"><Label>Required skills</Label><div className="flex flex-wrap gap-2">{skillList.filter(s => !s.archived).map(s => { const on = f.skills.includes(s.id); return <button key={s.id} type="button" aria-pressed={on} onClick={() => setF({ ...f, skills: on ? f.skills.filter(x => x !== s.id) : [...f.skills, s.id] })} className={`min-h-9 rounded-full border px-3 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{s.name}</button>; })}</div></div>}
            {f.tech !== "none" && f.assistant !== "none" && f.teamSize > 2 && <div className="space-y-2"><Label>More crew</Label>
              {f.crew.map((c, i) => <div key={i} className="flex gap-2"><select aria-label={`Crew member ${i + 3}`} className="h-11 flex-1 rounded-md border bg-background px-2 text-sm" value={c} onChange={e => setF({ ...f, crew: f.crew.map((x, j) => j === i ? e.target.value : x) })}>{ranked.filter(u => u.id === c || ![f.tech, f.assistant, ...f.crew].includes(u.id)).map(u => <option key={u.id} value={u.id}>{label(u)}</option>)}</select><Button type="button" variant="outline" className="h-11" onClick={() => setF({ ...f, crew: f.crew.filter((_, j) => j !== i) })} aria-label="Remove crew member"><X className="h-4 w-4" /></Button></div>)}
              {2 + f.crew.length < f.teamSize && (() => { const next = ranked.find(u => ![f.tech, f.assistant, ...f.crew].includes(u.id)); return next ? <Button type="button" variant="outline" className="h-11" onClick={() => setF({ ...f, crew: [...f.crew, next.id] })}><Plus className="mr-1 h-4 w-4" />Add technician</Button> : null; })()}
            </div>}
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={f.open} onCheckedChange={v => setF({ ...f, open: v === true })} /><span>Open to eligible technicians — clocked-in team members with the required skills can claim the remaining places ({Math.max(0, f.teamSize - ([f.tech, f.assistant].filter(x => x !== "none").length + f.crew.length))} left).</span></label>
          </div>}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>From</Label><Input type="time" value={f.window_start} onChange={(e) => setF({ ...f, window_start: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="time" value={f.window_end} onChange={(e) => setF({ ...f, window_end: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Problem summary</Label><SuggestedTextarea aria-label="Problem summary" value={f.problem_summary} onValueChange={problem_summary => setF({ ...f, problem_summary })} suggestions={suggestions?.problems} /></div>
          <Button type="submit" className="w-full">Schedule</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Office admins and supervisors resend a completed (signed) job sheet to chosen contacts. */
function ResendDialog({ sheet, sheetIds, onClose }: { sheet: { id: string; client_id: string; site_id: string | null; jobsheet_number: string }; sheetIds?: string[]; onClose: () => void }) {
  const { data: contacts = [] } = useQuery({
    queryKey: ["resend-contacts", sheet.client_id],
    queryFn: async () => (await supabase.from("client_contacts").select("id, first_name, last_name, email, role_title, site_id, receives_job_sheets").eq("client_id", sheet.client_id).not("email", "is", null)).data ?? [],
  });
  const combine = useServerFn(combinedJobSheets);
  const sendSingle = useServerFn(sendJobSheetEmail);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const sel = picked ?? contacts.filter((c) => c.receives_job_sheets && (!c.site_id || !sheet.site_id || c.site_id === sheet.site_id)).flatMap((c) => c.email ? [c.email] : []);
  const toggle = (e: string, on: boolean) => setPicked(on ? [...sel, e] : sel.filter((x) => x !== e));
  const send = async () => {
    const all = [...sel, ...extra.split(/[,;\s]+/).filter(Boolean)];
    if (!all.length) { toast.error("Pick at least one recipient"); return; }
    setBusy(true);
    try {
      const r = sheetIds ? await combine({ data: { sheetIds, recipients: all, email: true } }) : await sendSingle({ data: { sheetId: sheet.id, recipients: all } });
      if (r.sent) { toast.success(`Job sheet- ${sheet.jobsheet_number} resent to ${r.recipients.join(", ")}`); onClose(); }
      else toast.error("No recipients");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Send failed"); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{sheetIds ? `Email ${sheetIds.length} job sheets as one PDF` : `Resend Job sheet- ${sheet.jobsheet_number}`}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{sheetIds ? "The signed job sheets and work photos will be sent in one PDF, oldest first." : "The signed PDF and work photos are sent again. No new signature is requested."}</p>
        <div className="space-y-2">
          {contacts.length === 0 && <p className="text-sm text-muted-foreground">This client has no contacts with an email.</p>}
          {contacts.filter((c) => !!c.email).map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={sel.includes(c.email ?? "")} onCheckedChange={(b) => toggle(c.email ?? "", !!b)} />
              <span className="font-medium">{c.first_name} {c.last_name ?? ""}</span>
              <span className="truncate text-muted-foreground">{c.role_title ? `${c.role_title} · ` : ""}{c.email}</span>
            </label>
          ))}
        </div>
        <div className="space-y-1.5"><Label>Other email (optional)</Label><Input type="email" placeholder="name@example.com" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={send}><Mail className="mr-1 h-4 w-4" />{busy ? "Sending…" : sheetIds ? "Send combined PDF" : "Resend"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
