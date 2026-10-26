import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
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
import { dispatchTeamSize, groupSkills, skillMatchScore, FIELD_TRADES, matchesTrade } from "@/lib/skills";
import { clientRecipients } from '@/lib/client-recipients';
import { closeDispatchedReport, DISPATCH_REFRESH_KEYS } from "@/lib/dispatch-report";
import { canDeleteSheet, canDeleteVisit, RECORD_DELETE_REFRESH_KEYS } from "@/lib/record-deletion";
import { DispatchedVisits } from "@/components/dispatched-visits";
import { NumInput } from "@/components/num-input";
import { useEntrySuggestions } from "@/hooks/use-entry-suggestions";
import { notifyOpenJob } from "@/lib/web-push.functions";
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
import { ClientSitePicker } from "@/components/client-site-picker";
import { isDispatchable, useFieldDispatchIds } from "@/lib/member-capabilities";

export type PendingDispatch = {id:string;pending_status:string;client_id:string;site_id:string|null;asset_id:string|null;pending_works_future_jobs:string|null;jobsheet_number:string};
export function NewJobDialog({pending,onClose}:{pending?:PendingDispatch;onClose?:()=>void}) {
  const { data: profile } = useProfile();
  const { data: suggestions } = useEntrySuggestions();
  const { data: allUsers = [] } = useCompanyUsers();
  const { data: fieldIds } = useFieldDispatchIds();
  // Field crew: field roles, plus office members granted the field-dispatch capability.
  const users = allUsers.filter(u => isDispatchable(u.role, u.registration_status === 'active', !!fieldIds?.has(u.id)));
  const qc = useQueryClient();
  const search = useSearch({strict:false}) as {new?:boolean;assetId?:string;problemId?:string};
  const navigate = useNavigate();
  const [open, setOpenRaw] = useState(!!pending || !!search.new);
  const setOpen = (o: boolean) => { setOpenRaw(o); if (!o) { onClose?.(); prefilled.current = null; if (search.new || search.assetId || search.problemId) navigate({ to: "/admin/jobs", search: {}, replace: true }); } };
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const empty = { client_id: "", site_id: "none", asset_id: "none", tech: "none", assistant: "none", scheduled_date: new Date().toISOString().slice(0, 10), window_start: "", window_end: "", priority: "normal", problem_summary: "", teamSize: 1, open: false, skills: [] as string[], crew: [] as string[] };
  const [f, setF] = useState({...empty,...(pending?{client_id:pending.client_id,site_id:pending.site_id??'none',asset_id:pending.asset_id??'none',problem_summary:`Follow-up from #${pending.jobsheet_number}: ${pending.pending_works_future_jobs??''}`}:{})});
  const feature = usePlanFeatures(!!profile);
  const smart = feature("skills_dispatch");
  const [trade,setTrade]=useState('');
  const [category,setCategory]=useState('all');
  const { data: skillList = [] } = useQuery({ queryKey: ["company-skills"], enabled: smart, queryFn: async () => (await supabase.from("company_skills").select("id,name,category,archived").order("name")).data ?? [] });
  const { data: memberSkills = [] } = useQuery({ queryKey: ["member-skills"], enabled: smart, queryFn: async () => (await supabase.from("member_skills").select("user_id,skill_id")).data ?? [] });
  const skillsOf = (u: string) => memberSkills.filter(m => m.user_id === u).map(m => m.skill_id);
  const eligible=users.filter(u=>!smart||matchesTrade(skillsOf(u.id).map(id=>skillList.find(s=>s.id===id)?.name??''),trade));
  const ranked = smart && f.skills.length ? [...eligible].sort((a, b) => skillMatchScore(skillsOf(b.id), f.skills) - skillMatchScore(skillsOf(a.id), f.skills)) : eligible;
  const label = (u: { id: string; full_name: string }) => smart && f.skills.length ? `${u.full_name} · ${skillMatchScore(skillsOf(u.id), f.skills)}/${f.skills.length} skills` : u.full_name;
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: async () => (await supabase.from("sites").select("id, client_id, name").order("name")).data ?? [] });
  const { data: assets = [] } = useQuery({ queryKey: ["assets-all"], queryFn: async () => (await supabase.from("assets").select("id, client_id, site_id, reference_number, asset_category")).data ?? [] });

  // QR problem report → pre-fill client, site, equipment and the reported problem.
  const prefilled = useRef<string | null>(null);
  useEffect(() => { if (search.new) setOpenRaw(true); }, [search.new, search.assetId, search.problemId]);
  useEffect(() => {
    const a = search.assetId && assets.find((x) => x.id === search.assetId);
    const key = `${search.assetId}|${search.problemId ?? ""}`;
    if (!open || !a || prefilled.current === key) return;
    prefilled.current = key;
    void (async () => {
      let problem = "";
      if (search.problemId) { const r = await supabase.from("equipment_problem_reports").select("problem").eq("id", search.problemId).maybeSingle(); problem = r.data?.problem ?? ""; }
      setF((cur) => ({ ...cur, client_id: a.client_id, site_id: a.site_id ?? "none", asset_id: a.id, problem_summary: problem || cur.problem_summary }));
    })();
  }, [open, search.assetId, search.problemId, assets]);

  const uuidOrNull = (v: string | null | undefined) => { const t = (v ?? "").trim(); return !t || t === "none" ? null : t; };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (!profile || !f.client_id) { toast.error("Pick a client"); return; }
    const named = [f.tech, f.assistant].filter(x => x !== "none").length + f.crew.length;
    const teamSize = dispatchTeamSize(f.teamSize, smart, named);
    if (named > teamSize) { toast.error(`You picked ${named} people for a team of ${teamSize}`); return; }
    if (!f.open && f.tech === "none" && f.crew.length) { toast.error("Choose a lead technician"); return; }
    savingRef.current = true; setSaving(true);
    try {
    const { data: job, error } = pending ? await (async()=>{
      const r=await supabase.rpc('dispatch_pending_work',{_sheet:pending.id,_expected:pending.pending_status,_dispatch:{...f,teamSize,skills:smart?f.skills:[],crew:smart?f.crew:[],open:smart&&f.open}});
      return {data:r.data?{id:r.data,job_number:''}:null,error:r.error};
    })() : await supabase.from("jobs").insert({
      company_id: profile.company_id, client_id: f.client_id,
      site_id: uuidOrNull(f.site_id), asset_id: uuidOrNull(f.asset_id),
      assigned_technician_id: uuidOrNull(f.tech), secondary_technician_id: uuidOrNull(f.assistant), scheduled_date: f.scheduled_date,
      window_start: f.window_start || null, window_end: f.window_end || null, priority: f.priority, problem_summary: f.problem_summary || null,
      required_team_size: teamSize,
      ...(smart ? { open_to_claim: f.open && named < teamSize } : {}),
    }).select("id, job_number").single();
    if (error) { toast.error(error.message); return; }
    const reportWarning = await closeDispatchedReport(search.problemId, uuidOrNull(f.asset_id));
    if (smart && job && !pending) {
      if (f.skills.length) { const r = await supabase.from("job_skills").insert(f.skills.map(skill_id => ({ job_id: job.id, skill_id, company_id: profile.company_id, mandatory: true }))); if (r.error) toast.error(r.error.message); }
      if (f.crew.length) { const r = await supabase.from("job_crew").insert(f.crew.map(user_id => ({ job_id: job.id, user_id, company_id: profile.company_id }))); if (r.error) toast.error(r.error.message); }
      if (f.open && named < teamSize) void notifyOpenJob({ data: { jobId: job.id } }).catch(() => undefined);
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
    if (reportWarning) toast.warning(reportWarning);
    setOpen(false); setF(empty);
    await Promise.all([...DISPATCH_REFRESH_KEYS,"pending-works","attention-overview"].map(key => qc.invalidateQueries({ queryKey: [key] })));
    } finally { savingRef.current = false; setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-tour="dispatch" size="sm" className={pending?"hidden":"h-11"}><Plus className="mr-1 h-4 w-4" />Team dispatch</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{pending?`Dispatch pending work — #${pending.jobsheet_number}`:"Team dispatch — New job"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ClientSitePicker disabled={!!pending} clientId={f.client_id || null} siteId={f.site_id === "none" ? null : f.site_id} onChange={(client, site) => setF((cur) => ({ ...cur, client_id: client ?? "", site_id: site ?? "none", asset_id: client === cur.client_id ? cur.asset_id : "none" }))} />
            <Select disabled={!!pending} value={f.asset_id} onValueChange={(v) => { if (v) setF((cur) => ({ ...cur, asset_id: v })); }}>
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
            <div><Label htmlFor="dispatch-trade">Field staff trade</Label><select id="dispatch-trade" className="h-11 w-full rounded-md border bg-background px-2" value={trade} onChange={e=>setTrade(e.target.value)}><option value="">All trades</option>{FIELD_TRADES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="team-size">Required team size</Label><NumInput id="team-size" className="h-11 w-28" min={1} max={30} step={1} value={f.teamSize} onChange={teamSize => setF({ ...f, teamSize })} /></div>
            {!!skillList.filter(s=>!s.archived).length && <fieldset className="space-y-3"><legend className="text-sm font-medium">Required skills</legend>
              <div><Label htmlFor="dispatch-category">Skills category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger id="dispatch-category"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{groupSkills(skillList.filter(s=>!s.archived)).map(([name])=><SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
              {groupSkills(skillList.filter(s=>!s.archived)).filter(([name])=>category==='all'||name===category).map(([name,skills])=><div key={name} className="space-y-2"><p className="text-xs font-medium text-muted-foreground">{name}</p><div className="grid gap-2 sm:grid-cols-2">{skills.map(s=><label key={s.id} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"><Checkbox className="rounded-full" checked={f.skills.includes(s.id)} onCheckedChange={checked=>setF(cur=>({...cur,skills:checked===true?[...new Set([...cur.skills,s.id])]:cur.skills.filter(id=>id!==s.id)}))}/><span>{s.name}</span></label>)}</div></div>)}
              {!!f.skills.length&&<div className="flex flex-wrap gap-2">{f.skills.map(id=>{const skill=skillList.find(s=>s.id===id);return skill?<Button key={id} type="button" size="sm" variant="secondary" onClick={()=>setF(cur=>({...cur,skills:cur.skills.filter(x=>x!==id)}))} aria-label={`Remove required skill ${skill.name}`}>{skill.name}<X className="ml-1 h-3 w-3"/></Button>:null;})}</div>}
            </fieldset>}
            {f.tech !== "none" && f.assistant !== "none" && f.teamSize > 2 && <div className="space-y-2"><Label>More crew</Label>
              {f.crew.map((c, i) => <div key={i} className="flex gap-2"><select aria-label={`Crew member ${i + 3}`} className="h-11 flex-1 rounded-md border bg-background px-2 text-sm" value={c} onChange={e => setF({ ...f, crew: f.crew.map((x, j) => j === i ? e.target.value : x) })}>{ranked.filter(u => u.id === c || ![f.tech, f.assistant, ...f.crew].includes(u.id)).map(u => <option key={u.id} value={u.id}>{label(u)}</option>)}</select><Button type="button" variant="outline" className="h-11" onClick={() => setF({ ...f, crew: f.crew.filter((_, j) => j !== i) })} aria-label="Remove crew member"><X className="h-4 w-4" /></Button></div>)}
              {2 + f.crew.length < f.teamSize && (() => { const next = ranked.find(u => ![f.tech, f.assistant, ...f.crew].includes(u.id)); return next ? <Button type="button" variant="outline" className="h-11" onClick={() => setF({ ...f, crew: [...f.crew, next.id] })}><Plus className="mr-1 h-4 w-4" />Add technician</Button> : null; })()}
            </div>}
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={f.open} onCheckedChange={v => setF({ ...f, open: v === true })} /><span>Open to eligible technicians — clocked-in team members with the required skills can claim the remaining places ({Math.max(0, f.teamSize - ([f.tech, f.assistant].filter(x => x !== "none").length + f.crew.length))} left).</span></label>
          </div>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Arrive from (optional)</Label><Input type="time" value={f.window_start} onChange={(e) => setF({ ...f, window_start: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Until (optional)</Label><Input type="time" value={f.window_end} onChange={(e) => setF({ ...f, window_end: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Problem summary</Label><SuggestedTextarea aria-label="Problem summary" value={f.problem_summary} onValueChange={problem_summary => setF({ ...f, problem_summary })} suggestions={suggestions?.problems} /></div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Creating…" : "Create job"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

