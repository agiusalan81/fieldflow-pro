import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Repeat, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers, isManager, isOffice } from "@/lib/profile";
import { useCompanyRules } from "@/lib/company";
import { standbyFor, validStandbyStaffing, clampStandbyStaffing, type StandbyConfig } from "@/lib/dwr";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/standby")({
  head: () => ({
    meta: [
      { title: "On-call rota — FieldBridge" },
      { name: "description", content: "After-hours standby roster with shift swaps between technicians." },
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
  // Start at today so upcoming standby days always show the swap option.
  const [week, setWeek] = useState(() => today0());
  const [ask, setAsk] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const { data: swaps = [] } = useQuery({
    queryKey: ["standby-swaps"],
    queryFn: async () => (await supabase.from("standby_swaps").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  if (!profile || !company) return <AppShell title="On-call rota"><p className="text-muted-foreground">Loading…</p></AppShell>;
  const cfg = company.standby;
  const name = (id: string) => users.find((u) => u.id === id)?.full_name ?? "—";
  const days = Array.from({ length: 7 }, (_, i) => iso(new Date(week.getFullYear(), week.getMonth(), week.getDate() + i)));
  const techs = users.filter((u) => u.role === "technician" || cfg.order.includes(u.id));
  const refresh = () => qc.invalidateQueries({ queryKey: ["standby-swaps"] });

  const request = async () => {
    if (!ask || !target) return;
    const { error } = await supabase.from("standby_swaps").insert({ company_id: profile.company_id, swap_date: ask, requester_id: profile.id, target_id: target, end_date: end || ask, note: note.trim() || null });
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
  const incoming = swaps.filter((s) => s.target_id === profile.id && s.status === "pending");
  const mine = swaps.filter((s) => s.requester_id === profile.id);

  return (
    <AppShell title="On-call rota">
      <div className="mx-auto max-w-5xl space-y-5">
        {incoming.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-warning bg-warning/10 p-4">
            <Repeat className="h-5 w-5 text-foreground" />
            <p className="flex-1 text-sm text-foreground"><b>{name(s.requester_id)}</b> asks you to take their standby on <b>{s.swap_date}{s.end_date && s.end_date !== s.swap_date ? ` → ${s.end_date}` : ""}</b>{s.note ? ` · ${s.note}` : ""}.</p>
            <Button size="sm" variant="outline" onClick={() => answer(s.id, "declined")}>Decline</Button>
            <Button size="sm" onClick={() => answer(s.id, "accepted")}>Accept</Button>
          </div>
        ))}

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-foreground">7 days from {week.toLocaleDateString([], { day: "numeric", month: "long" })}</h2>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" aria-label="Previous week" onClick={() => setWeek(new Date(week.getFullYear(), week.getMonth(), week.getDate() - 7))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setWeek(today0())}>This week</Button>
              <Button size="icon" variant="ghost" aria-label="Next week" onClick={() => setWeek(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          {cfg.order.length === 0 ? <EmptyState>No one is on the roster yet.{isOffice(profile) || profile.role === "supervisor" ? " Add technicians in the roster settings below." : " Ask the office to set it up."}</EmptyState> : (
            <div className="grid gap-2 sm:grid-cols-7">
              {days.map((d) => {
                const ids = standbyFor(d, cfg, swaps);
                const isToday = d === iso(new Date());
                return (
                  <div key={d} className={`min-h-28 rounded-lg border p-2 ${isToday ? "border-primary" : ""}`}>
                    <p className="text-xs text-muted-foreground">{new Date(d + "T00:00").toLocaleDateString([], { weekday: "short", day: "numeric" })}</p>
                    <ul className="mt-1 space-y-1">
                      {ids.map((id) => (
                        <li key={id} className={`rounded px-1.5 py-1 text-xs ${id === profile.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                          {name(id)}
                          {id === profile.id && d >= iso(new Date()) && <button type="button" className="ml-1 underline" onClick={() => { setAsk(d); setEnd(d); setNote(""); }}>swap</button>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Rotates every {cfg.rotationDays} day{cfg.rotationDays > 1 ? "s" : ""} · {cfg.perShift} on standby at a time. Tap "swap" on your own day to ask a colleague.</p>
        </section>

        {mine.length > 0 && !isManager(profile) && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-2 font-medium text-foreground">My swap requests</h2>
            <SwapList swaps={mine} name={name} onCancel={(id) => answer(id, "cancelled")} meId={profile.id} />
          </section>
        )}

        {isManager(profile) && swaps.filter(s=>s.status==="accepted"&&!s.manager_approved).map(s=><div key={s.id} className="flex flex-wrap items-center gap-3 border-l-2 border-warning p-3 text-sm"><p className="flex-1">{name(s.requester_id)} → {name(s.target_id)} · {s.swap_date} → {s.end_date ?? s.swap_date} · Awaiting approval</p><Button size="sm" disabled={[s.requester_id,s.target_id].includes(profile.id)} onClick={async()=>{const r=await supabase.from("standby_swaps").update({manager_approved:true}).eq("id",s.id);if(r.error)toast.error(r.error.message);else{toast.success("Swap approved — rota updated");refresh();}}}>Approve swap</Button><Button size="sm" variant="outline" onClick={()=>answer(s.id,"cancelled")}>Decline swap</Button></div>)}
        {isManager(profile) && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-2 font-medium text-foreground">All swap requests</h2>
            {swaps.length === 0 ? <p className="text-sm text-muted-foreground">No swap requests yet.</p> : <SwapList swaps={swaps} name={name} onCancel={(id) => answer(id, "cancelled")} meId={profile.id} manager />}
          </section>
        )}

        {(isOffice(profile) || profile.role === "supervisor") && (usersLoading ? <p className="text-sm text-muted-foreground">Loading registered technicians…</p> : usersError ? <p className="text-sm text-destructive">Unable to load registered technicians. Try again before saving the roster.</p> : <RosterSettings cfg={cfg} techs={techs} registeredTechnicians={users.filter((u) => u.role === "technician").length} companyId={profile.company_id} />)}
      </div>

      <Dialog open={!!ask} onOpenChange={(o) => !o && setAsk(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Swap standby on {ask && new Date(ask + "T00:00").toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3"><div><Label>From</Label><Input type="date" value={ask ?? ""} min={iso(new Date())} onChange={e=>setAsk(e.target.value)}/></div><div><Label>To</Label><Input type="date" value={end} min={ask ?? ""} onChange={e=>setEnd(e.target.value)}/></div></div>
          <Label>Reason (optional)</Label><Input maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/>
          <div className="space-y-1.5"><Label>Ask colleague</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Choose a technician" /></SelectTrigger>
              <SelectContent>{techs.filter((u) => u.id !== profile.id && !(ask && standbyFor(ask, cfg, swaps).includes(u.id))).map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Colleague acceptance is followed by supervisor/admin approval before the rota changes.</p>
          <Button className="h-11" disabled={!target} onClick={request}>Send request</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SwapList({ swaps, name, onCancel, meId, manager }: { swaps: { id: string; swap_date: string; requester_id: string; target_id: string; status: string; created_at: string; end_date?: string | null; manager_approved?: boolean }[]; name: (id: string) => string; onCancel: (id: string) => void; meId: string; manager?: boolean }) {
  return (
    <ul className="divide-y text-sm">
      {swaps.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className="tabular-nums text-muted-foreground">{s.swap_date}{s.end_date && s.end_date !== s.swap_date ? ` → ${s.end_date}` : ""}</span>
          <span className="flex-1 text-foreground">{name(s.requester_id)} → {name(s.target_id)}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${SWAP_CLS[s.status] ?? ""}`}>{s.status === "accepted" ? (s.manager_approved ? "Approved" : "Awaiting manager") : s.status}</span>
          <span className="text-xs text-muted-foreground">asked {new Date(s.created_at).toLocaleDateString()}</span>
          {s.status === "pending" && (s.requester_id === meId || manager) && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Cancel request" onClick={() => onCancel(s.id)}><X className="h-3.5 w-3.5" /></Button>}
        </li>
      ))}
    </ul>
  );
}

function RosterSettings({ cfg, techs, registeredTechnicians, companyId }: { cfg: StandbyConfig; techs: { id: string; full_name: string }[]; registeredTechnicians: number; companyId: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(cfg);
  useEffect(() => setF({ ...cfg, perShift: clampStandbyStaffing(cfg.perShift, registeredTechnicians) }), [cfg, registeredTechnicians]);
  const name = (id: string) => techs.find((u) => u.id === id)?.full_name ?? "—";
  const move = (i: number, d: number) => { const o = [...f.order]; const j = i + d; const from = o[i]; const to = o[j]; if (from === undefined || to === undefined) return; o[i] = to; o[j] = from; setF({ ...f, order: o }); };
  const save = async () => {
    if (!validStandbyStaffing(f.perShift, registeredTechnicians)) {
      toast.error(registeredTechnicians === 0 ? "Register a technician before setting up the roster." : `Only ${registeredTechnicians} technicians are registered. Reduce technicians per shift.`);
      return;
    }
    void companyId;
    const { error } = await supabase.rpc("save_standby_roster", { _start: f.start, _rotation_days: f.rotationDays, _per_shift: f.perShift, _order: f.order });
    if (error) { toast.error(error.message); return; }
    toast.success("Roster saved");
    qc.invalidateQueries({ queryKey: ["company-settings"] });
  };
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-medium text-foreground">Roster settings</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label>Rotate every</Label>
          <Select value={String(f.rotationDays)} onValueChange={(v) => setF({ ...f, rotationDays: Number(v) })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{[[1, "Day"], [2, "2 days"], [3, "3 days"], [7, "Week"], [14, "2 weeks"]].map(([v, l]) => <SelectItem key={v} value={String(v)}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="standby-staffing">Technicians per shift</Label><Input id="standby-staffing" className="h-11" type="number" min={registeredTechnicians ? 1 : 0} max={registeredTechnicians} step={1} disabled={registeredTechnicians === 0} value={f.perShift} onChange={(e) => setF({ ...f, perShift: clampStandbyStaffing(Number(e.target.value), registeredTechnicians) })} /><p className="text-xs text-muted-foreground">{registeredTechnicians} registered technician{registeredTechnicians === 1 ? "" : "s"} · maximum {registeredTechnicians} per shift</p></div>
        <div className="space-y-1.5"><Label>Rotation starts on</Label><Input className="h-11" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
      </div>
      <div className="space-y-2">
        <Label>Order of technicians</Label>
        <ul className="space-y-1">
          {f.order.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm">
              <span className="w-6 text-muted-foreground">{i + 1}.</span><span className="flex-1">{name(id)}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove" onClick={() => setF({ ...f, order: f.order.filter((x) => x !== id) })}><X className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
        </ul>
        <Select value="" onValueChange={(v) => setF({ ...f, order: [...f.order, v] })}>
          <SelectTrigger className="h-10 sm:max-w-xs"><SelectValue placeholder="Add technician to roster" /></SelectTrigger>
          <SelectContent>{techs.filter((u) => !f.order.includes(u.id)).map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button className="h-11" disabled={!validStandbyStaffing(f.perShift, registeredTechnicians)} onClick={save}>Save roster</Button>
    </section>
  );
}
