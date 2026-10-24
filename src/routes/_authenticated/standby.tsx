import { swapReminderDue } from "@/lib/swap-reminders";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Repeat, X, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers, isManager, isOffice } from "@/lib/profile";
import { useCompanyRules } from "@/lib/company";
import { type StandbyConfig } from "@/lib/dwr";
import { rotaFor, freeForRange, validRota, weeklyRota, activeRotaMember, ROTA_TRACKS, trackLabel, type RotaTrack } from "@/lib/rota";
import { usePlanFeatures } from "@/lib/plan-features";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nextWeekday } from '@/lib/testing-rules';

export const Route = createFileRoute("/_authenticated/standby")({ staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): { swap?: string } => ({ ...(typeof s["swap"] === "string" ? {swap:s["swap"]} : {}) }),
  head: () => ({
    meta: [
      { title: "On-call rota — FieldBridge" },
      { name: "description", content: "Independent technician and supervisor on-call rotas, contacts and approved swaps." },
      { property: "og:title", content: "On-call rota — FieldBridge" },
      { property: "og:description", content: "Who is on call after hours, week by week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StandbyPage,
});

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const SWAP_CLS: Record<string, string> = { pending: "bg-warning/25 text-foreground", accepted: "bg-success/15 text-success", declined: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground" };

function StandbyPage() {
  const { data: profile } = useProfile();
  const { data: users = [], isLoading: usersLoading, error: usersError } = useCompanyUsers();
  const { data: company } = useCompanyRules();
  const qc = useQueryClient();
  const { swap: focusedSwap } = Route.useSearch();
  const feature = usePlanFeatures(!!profile);
  const [askTrack, setAskTrack] = useState<RotaTrack>("technician");
  const { data: supervisorRoster } = useQuery({ queryKey: ["supervisor-roster", profile?.company_id], enabled: !!profile && feature("standby"), queryFn: async () => { const r = await supabase.from("supervisor_rosters").select("*").maybeSingle(); if(r.error) throw r.error; return r.data; } });
  const { data: contacts = [] } = useQuery({ queryKey: ["rota-contacts", profile?.company_id], enabled: !!profile && feature("standby"), queryFn: async () => { const r = await supabase.from("users").select("id,phone_number"); if(r.error) throw r.error; return r.data; } });
  // Start at today so upcoming standby days always show the swap option.
  const [week, setWeek] = useState(() => today0());
  const [ask, setAsk] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const { data: swaps = [] } = useQuery({
    queryKey: ["standby-swaps", profile?.company_id],
    refetchInterval: 15000,
    enabled: !!profile && feature("standby"),
    queryFn: async () => (await supabase.from("standby_swaps").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  useEffect(() => { if (focusedSwap && swaps.length) document.getElementById(`swap-${focusedSwap}`)?.scrollIntoView({block:"center"}); }, [focusedSwap, swaps]);
  if (!profile || !company) return <AppShell title="On-call rota"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!feature("standby")) return <AppShell title="On-call rota"><EmptyState>On-call rota is switched off for your company.</EmptyState></AppShell>;
  const configs: Record<RotaTrack, StandbyConfig> = { technician: company.standby, supervisor: { start: supervisorRoster?.start_date ?? iso(today0()), rotationDays: supervisorRoster?.rotation_days ?? 7, perShift: supervisorRoster?.per_shift ?? 1, order: supervisorRoster?.member_order ?? [] } };
  const cfg = configs[askTrack];
  const name = (id: string) => users.find((u) => u.id === id)?.full_name ?? "—";
  const days = Array.from({ length: 7 }, (_, i) => iso(new Date(week.getFullYear(), week.getMonth(), week.getDate() + i)));
  const techs = users.filter((u) => activeRotaMember(u, askTrack));
  const phone = (id: string) => contacts.find(u => u.id === id)?.phone_number;
  const refresh = () => Promise.all(["standby-swaps","action-notifications","on-call-menu-badge"].map(key => qc.invalidateQueries({queryKey:[key]})));
  const snooze = async (id: string) => { const r = await supabase.rpc("snooze_standby_swap", {_swap:id}); if(r.error) {toast.error(r.error.message); return;} toast.success("Swap reminder snoozed for 1 hour"); await refresh(); };

  const request = async () => {
    if (!ask || !target) return;
    const { error } = await supabase.from("standby_swaps").insert({ company_id: profile.company_id, swap_date: ask, requester_id: profile.id, target_id: target, end_date: end || ask, track: askTrack, note: note.trim() || null });
    if (error) { toast.error(error.message); return; }
    toast.success(`Swap request sent to ${name(target)}`);
    setAsk(null); setTarget(""); refresh();
  };
  const answer = async (id: string, status: "accepted" | "declined" | "cancelled") => {
    const { error } = await supabase.from("standby_swaps").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "accepted" ? "Accepted — awaiting manager approval" : status === "declined" ? "Swap declined" : "Request cancelled");
    refresh();
  };
  const incoming = swaps.filter((s) => s.target_id === profile.id && s.status === "pending" && (s.id === focusedSwap || swapReminderDue(s.snoozed_until)));
  const mine = swaps.filter((s) => s.requester_id === profile.id);

  return (
    <AppShell title="On-call rota">
      <div className="mx-auto max-w-5xl space-y-5">
        {incoming.map((s) => (
          <div key={s.id} id={`swap-${s.id}`} className={`flex flex-wrap items-center gap-3 rounded-lg border border-warning bg-warning/10 p-4 ${s.id === focusedSwap ? "ring-2 ring-primary" : ""}`}>
            <Repeat className="h-5 w-5 text-foreground" />
            <p className="flex-1 text-sm text-foreground"><b>{name(s.requester_id)}</b> asks you to take their standby on <b>{s.swap_date}{s.end_date && s.end_date !== s.swap_date ? ` → ${s.end_date}` : ""}</b>{s.note ? ` · ${s.note}` : ""}.</p>
            <Button size="sm" variant="outline" onClick={() => answer(s.id, "declined")}>Decline</Button>
            <Button size="sm" variant="outline" onClick={() => void snooze(s.id)}>Snooze</Button>
            <Button size="sm" onClick={() => answer(s.id, "accepted")}>Accept</Button>
          </div>
        ))}

        <section className="space-y-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-foreground">7 days from {week.toLocaleDateString([], { day: "numeric", month: "long" })}</h2>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" aria-label="Previous week" onClick={() => setWeek(new Date(week.getFullYear(), week.getMonth(), week.getDate() - 7))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setWeek(today0())}>This week</Button>
              <Button size="icon" variant="ghost" aria-label="Next week" onClick={() => setWeek(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-l-2 border-primary bg-muted/40 p-3 text-sm">
            <span className="font-medium">Supervisor on call today:</span>
            {rotaFor(iso(today0()), configs.supervisor, swaps, "supervisor").length === 0 ? <span className="text-muted-foreground">Not scheduled</span> : rotaFor(iso(today0()), configs.supervisor, swaps, "supervisor").map(id => <span key={id} className="flex items-center gap-2">{name(id)}{phone(id) && <Button asChild size="icon" variant="outline" aria-label={`Call ${name(id)}`} title={`Call ${name(id)}`}><a href={`tel:${phone(id)?.replace(/[^+\d]/g, "")}`}><Phone className="h-4 w-4"/></a></Button>}</span>)}
          </div>
          <div className="grid gap-2 sm:grid-cols-7">
            {days.map(d => <div key={d} className={`min-h-40 rounded-lg border p-2 ${d === iso(today0()) ? "border-primary" : ""}`}>
              <p className="text-xs font-medium text-muted-foreground">{new Date(d + "T00:00").toLocaleDateString([], { weekday: "short", day: "numeric" })}</p>
              {ROTA_TRACKS.map(track => <div key={track} className="mt-2 space-y-1">
                <p className="text-xs font-medium">{track === "technician" ? "Technicians" : "Supervisors"}</p>
                {rotaFor(d, configs[track], swaps, track).length === 0 && <p className="text-xs text-muted-foreground">Not scheduled</p>}
                {rotaFor(d, configs[track], swaps, track).map(id => <div key={id} className={`break-words rounded px-1.5 py-1 text-xs ${id === profile.id ? "bg-primary text-primary-foreground" : track === "supervisor" ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground"}`}>
                  {name(id)} · {trackLabel(track)}
                  <div className="flex flex-wrap items-center gap-1">{phone(id) && <Button asChild size="icon" variant="ghost" className="h-7 w-7 text-current" aria-label={`Call ${name(id)} on ${d}`} title="Call"><a href={`tel:${phone(id)?.replace(/[^+\d]/g, "")}`}><Phone className="h-3 w-3"/></a></Button>}
                    {id === profile.id && d >= iso(today0()) && <Button variant="link" size="sm" className="h-auto p-0 text-current" onClick={() => { setAskTrack(track); setAsk(d); setEnd(d); setNote(""); setTarget(""); }}>Swap</Button>}
                  </div>
                </div>)}
              </div>)}
            </div>)}
          </div>
        </section>

        {mine.length > 0 && !isManager(profile) && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-2 font-medium text-foreground">My swap requests</h2>
            <SwapList swaps={mine} name={name} onCancel={(id) => answer(id, "cancelled")} meId={profile.id} />
          </section>
        )}

        {isManager(profile) && swaps.filter(s=>s.status==="accepted"&&!s.manager_approved).map(s=><div key={s.id} id={`swap-${s.id}`} className={`flex flex-wrap items-center gap-3 border-l-2 border-warning p-3 text-sm ${s.id === focusedSwap ? "ring-2 ring-primary" : ""}`}><p className="flex-1">{name(s.requester_id)} → {name(s.target_id)} · {s.track} · {s.swap_date} → {s.end_date ?? s.swap_date} · Awaiting approval</p><Button size="sm" disabled={[s.requester_id,s.target_id].includes(profile.id)} onClick={async()=>{const r=await supabase.from("standby_swaps").update({manager_approved:true}).eq("id",s.id);if(r.error)toast.error(r.error.message);else{toast.success("Swap approved — rota updated");refresh();}}}>Approve swap</Button><Button size="sm" variant="outline" onClick={()=>answer(s.id,"cancelled")}>Decline swap</Button></div>)}
        {isManager(profile) && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-2 font-medium text-foreground">All swap requests</h2>
            {swaps.length === 0 ? <p className="text-sm text-muted-foreground">No swap requests yet.</p> : <SwapList swaps={swaps} name={name} onCancel={(id) => answer(id, "cancelled")} meId={profile.id} manager />}
          </section>
        )}

        {(isOffice(profile) || profile.role === "supervisor") && (usersLoading ? <p role="status">Loading registered members…</p> : usersError ? <p role="alert" className="text-destructive">Unable to load registered members.</p> : <div className="grid gap-6 lg:grid-cols-2">{ROTA_TRACKS.map(track => <RosterSettings key={track} cfg={configs[track]} techs={users} track={track} />)}</div>)}
      </div>

      <Dialog open={!!ask} onOpenChange={(o) => !o && setAsk(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{trackLabel(askTrack)} swap on {ask && new Date(ask + "T00:00").toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3"><div><Label>From</Label><Input type="date" value={ask ?? ""} min={iso(new Date())} onChange={e=>setAsk(e.target.value)}/></div><div><Label>To</Label><Input type="date" value={end} min={ask ?? ""} onChange={e=>setEnd(e.target.value)}/></div></div>
          <Label>Reason (optional)</Label><Input maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/>
          <div className="space-y-1.5"><Label>Ask colleague</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-11"><SelectValue placeholder={`Choose a ${askTrack}`} /></SelectTrigger>
              <SelectContent>{techs.filter((u) => u.id !== profile.id && (!ask || freeForRange(u.id, ask, end || ask, cfg, swaps, askTrack))).map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Colleague acceptance is followed by supervisor/admin approval before the rota changes.</p>
          <Button className="h-11" disabled={!target} onClick={request}>Send request</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SwapList({ swaps, name, onCancel, meId, manager }: { swaps: { id: string; swap_date: string; requester_id: string; target_id: string; status: string; created_at: string; end_date?: string | null; manager_approved?: boolean; track?: string }[]; name: (id: string) => string; onCancel: (id: string) => void; meId: string; manager?: boolean }) {
  return (
    <ul className="divide-y text-sm">
      {swaps.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className="tabular-nums text-muted-foreground">{s.swap_date}{s.end_date && s.end_date !== s.swap_date ? ` → ${s.end_date}` : ""}</span>
          <span className="flex-1 text-foreground">{name(s.requester_id)} → {name(s.target_id)} · {s.track ?? "technician"}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${SWAP_CLS[s.status] ?? ""}`}>{s.status === "accepted" ? (s.manager_approved ? "Approved" : "Awaiting manager") : s.status}</span>
          <span className="text-xs text-muted-foreground">asked {new Date(s.created_at).toLocaleDateString()}</span>
          {s.status === "pending" && (s.requester_id === meId || manager) && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Cancel request" onClick={() => onCancel(s.id)}><X className="h-3.5 w-3.5" /></Button>}
        </li>
      ))}
    </ul>
  );
}

function RosterSettings({ cfg, techs, track }: { cfg: StandbyConfig; techs: { id: string; full_name: string; registration_status: string; role: string }[]; track: RotaTrack }) {
  const qc = useQueryClient(); const [f, setF] = useState(cfg); const [rotation, setRotation] = useState(String(cfg.rotationDays)); const [staff, setStaff] = useState(String(cfg.perShift)); const [busy, setBusy] = useState(false);
  useEffect(() => { setF(cfg); setRotation(String(cfg.rotationDays)); setStaff(String(cfg.perShift)); }, [cfg.start, cfg.rotationDays, cfg.perShift, cfg.order.join(",")]);
  const name = (id: string) => techs.find(u => u.id === id)?.full_name ?? "Unavailable member";
  const move = (i: number, delta: number) => { const o = [...f.order]; const a = o[i]; const b = o[i + delta]; if (!a || !b) return; o[i] = b; o[i + delta] = a; setF({ ...f, order: o }); };
  const active = techs.filter(u => activeRotaMember(u, track));
  const draft = { ...f, rotationDays: Number(rotation), perShift: Number(staff) }; const valid = validRota(draft, active.map(u => u.id));
  const save = async () => {
    if (!valid || busy) return; setBusy(true);
    if (f.start !== cfg.start && !window.confirm(`Change ${track} handover anchor to ${f.start}? Future assignments will be recalculated; saved swaps remain.`)) { setBusy(false); return; }
    const r = await supabase.rpc("save_standby_track", { _track: track, _start: f.start, _rotation_days: draft.rotationDays, _per_shift: Number(staff), _order: f.order });
    setBusy(false); if (r.error) { toast.error(r.error.message); return; } toast.success(`${trackLabel(track)} roster saved`);
    await Promise.all([qc.invalidateQueries({ queryKey: ["company-settings"] }), qc.invalidateQueries({ queryKey: ["supervisor-roster"] }), qc.invalidateQueries({ queryKey: ["standby-swaps"] })]);
  };
  return <section className="space-y-4 border-t pt-4">
    <h2 className="font-medium">{track === "technician" ? "Technician" : "Supervisor"} roster settings</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor={`${track}-rotation`}>Rotate every (days)</Label><Input id={`${track}-rotation`} type="number" inputMode="numeric" min="1" max="365" step="1" value={rotation} onFocus={e => e.currentTarget.select()} onChange={e => setRotation(e.target.value)}/></div>
      <div className="space-y-1.5"><Label htmlFor={`${track}-staffing`}>{track === "technician" ? "Technicians" : "Supervisors"} per shift</Label><Input id={`${track}-staffing`} type="number" min="1" max={Math.max(1,f.order.length)} step="1" value={staff} onFocus={e => e.currentTarget.select()} onChange={e => setStaff(e.target.value)} onBlur={() => { if (!staff.trim()) setStaff("1"); }}/></div>
      <div className="space-y-1.5 sm:col-span-2"><Label>Rotation starts on</Label><Input type="date" value={f.start} onChange={e => setF({ ...f, start: e.target.value })}/></div>
      {weeklyRota(draft.rotationDays) && <div className="space-y-1.5"><Label>Handover weekday</Label><Select value={String(new Date(`${f.start}T12:00:00Z`).getUTCDay())} onValueChange={v => setF({ ...f, start: nextWeekday(f.start, Number(v)) })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day,i) => <SelectItem key={day} value={String(i)}>{day}</SelectItem>)}</SelectContent></Select></div>}
    </div>
    <ul className="space-y-1">{f.order.map((id,i) => <li key={id} className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm"><span>{i+1}.</span><span className="min-w-0 flex-1 break-words">{name(id)}{!active.some(u => u.id === id) && <span className="ml-2 text-destructive">{techs.find(u => u.id === id)?.registration_status === "terminated" ? "Terminated · No longer available" : "No longer eligible"}</span>}</span><Button size="icon" variant="ghost" disabled={i===0} aria-label={`Move ${name(id)} up`} onClick={() => move(i,-1)}><ArrowUp className="h-4 w-4"/></Button><Button size="icon" variant="ghost" disabled={i===f.order.length-1} aria-label={`Move ${name(id)} down`} onClick={() => move(i,1)}><ArrowDown className="h-4 w-4"/></Button><Button size="icon" variant="ghost" aria-label={`Remove ${name(id)}`} onClick={() => setF({ ...f, order: f.order.filter(x => x!==id) })}><X className="h-4 w-4"/></Button></li>)}</ul>
    <Select value="" onValueChange={v => setF({ ...f, order: [...f.order,v] })}><SelectTrigger><SelectValue placeholder={`Add ${track} to roster`}/></SelectTrigger><SelectContent>{active.filter(u => !f.order.includes(u.id)).map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent></Select>
    {!valid && <p role="alert" className="text-sm text-destructive">Choose active members, a rotation of 1–365 whole days and a staffing count no greater than the roster size.</p>}
    <Button disabled={!valid || busy} onClick={() => void save()}>{busy ? "Saving…" : `Save ${track} roster`}</Button>
  </section>;
}
