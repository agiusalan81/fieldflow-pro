import { playChime } from "@/lib/chime";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DoorClosed, LogOut, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createDraftSheet } from "@/lib/jobsheets";
import { sendClientNotice } from "@/lib/client-notices.functions";
import { parseIntegrations, type EventKey } from "@/lib/integrations";
import { RETURN_FEE_MIN_HOURS } from "@/lib/billing";
import { Checkbox } from "@/components/ui/checkbox";
import type { Profile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Result = { channel: string; to: string; ok: boolean; error?: string }[];
function report(r: Result) {
  const ok = r.filter((x) => x.ok).map((x) => x.channel === "email" ? "email" : "WhatsApp");
  const bad = r.filter((x) => !x.ok).map((x) => `${x.channel === "email" ? "Email" : "WhatsApp"}: ${x.error}`);
  if (ok.length) toast.success(`Client notified by ${[...new Set(ok)].join(" and ")}`);
  if (bad.length) toast.warning(bad.join(" · "), { duration: 10000 });
  if (!r.length) toast.warning("No channel is ticked for this message in Company settings.");
}

/** Whether a field notice is switched on in Company settings → Messages & emails. */
export function useNoticeEnabled(event: EventKey) {
  const { data } = useQuery({
    queryKey: ["notice-settings"], staleTime: 60000,
    queryFn: async () => parseIntegrations((await supabase.from("company_settings").select("integrations").maybeSingle()).data?.integrations),
  });
  return data ? data.templates[event].enabled : false;
}

const seen = new Set<string>();
/** App-wide live alert for the technician when a manager replies to or decides on a request to leave an unsigned site. Tapping opens the job sheet. */
export function DepartureAlerts({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ text: string; ok: boolean; sheetId: string } | null>(null);
  useEffect(() => {
    const notify = (title: string, body: string, sheetId: string) => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification(title, { body, tag: `departure-${sheetId}` });
        n.onclick = () => { window.focus(); navigate({ to: "/sheets/$sheetId", params: { sheetId } }); n.close(); };
      }
      if (navigator.vibrate) navigator.vibrate(300);
    };
    const ch = supabase.channel(`departure-${userId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "job_sheets", filter: `assigned_technician_id=eq.${userId}` }, (p) => {
      const n = p.new as { id: string; jobsheet_number: number; departure_status: string; departure_reply: string | null }; const o = p.old as { departure_status?: string; departure_reply?: string | null };
      if (o.departure_reply !== n.departure_reply && n.departure_reply) {
        const key = `${n.id}:reply:${n.departure_reply}`;
        if (!seen.has(key)) {
          seen.add(key);
          const text = `Job sheet- ${n.jobsheet_number} — message from your supervisor: ${n.departure_reply}`;
          setMsg({ text, ok: true, sheetId: n.id }); playChime("message", userId);
          qc.invalidateQueries({ queryKey: ["sheet", n.id] });
          notify("Message from your supervisor", text, n.id);
        }
        return;
      }
      const key = `${n.id}:${n.departure_status}`;
      if (o.departure_status === n.departure_status || !["approved", "rejected"].includes(n.departure_status) || seen.has(key)) return;
      seen.add(key);
      const ok = n.departure_status === "approved";
      const text = ok ? `Job sheet- ${n.jobsheet_number}: you may leave site. The client has been notified.` : `Job sheet- ${n.jobsheet_number}: leaving was declined — please wait for the client.`;
      setMsg({ text, ok, sheetId: n.id }); playChime("approval", userId);
      qc.invalidateQueries({ queryKey: ["sheet", n.id] });
      notify(ok ? "Departure approved" : "Departure declined", text, n.id);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, navigate, qc]);
  if (!msg) return null;
  return (
    <div className={`mb-4 rounded-xl border p-4 ${msg.ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10"}`}>
      <p className="text-sm font-medium text-foreground">{msg.text}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" asChild onClick={() => setMsg(null)}><Link to="/sheets/$sheetId" params={{ sheetId: msg.sheetId }}>Open job sheet</Link></Button>
        <Button size="sm" variant="ghost" onClick={() => setMsg(null)}>Dismiss</Button>
      </div>
    </div>
  );
}

/** Dashboard button: record an attended visit where nobody opened, then notify the client. */
export function NoAccessButton({ profile, jobs }: { profile: Profile; jobs: { id: string; job_number: number; clients: { name: string } | null; sites: { name: string } | null }[] }) {
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const enabled = useNoticeEnabled("no_access");
  const go = async () => {
    if (!jobId) { toast.error("Pick the job you attended"); return; }
    setBusy(true);
    try {
      const id = await createDraftSheet(profile, jobId);
      const now = new Date();
      const t = now.toTimeString().slice(0, 5);
      const { error } = await supabase.from("job_sheets").update({
        visit_outcome: "no_access", status: "completed", work_start_time: now.toISOString(), work_end_time: now.toISOString(),
        repairs_performed: `Attended call-out — no one available to open.${note.trim() ? ` ${note.trim()}` : ""}`,
      }).eq("id", id);
      if (error) throw error;
      await supabase.from("jobsheet_time_logs").delete().eq("jobsheet_id", id);
      await supabase.from("jobsheet_time_logs").insert({ jobsheet_id: id, company_id: profile.company_id, log_date: now.toISOString().slice(0, 10), time_in: t, time_out: t, daily_work_description: "Attended — no access", technician_initials: [], sort_order: 0 });
      await supabase.from("jobs").update({ acknowledged_at: now.toISOString() }).eq("id", jobId);
      const res = await sendClientNotice({ data: { sheetId: id, event: "no_access" } });
      report(res.result);
      qc.invalidateQueries({ queryKey: ["today-jobs"] });
      setOpen(false); setJobId(null); setNote("");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  if (!enabled) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-12 w-full"><DoorClosed className="mr-2 h-5 w-5" />Attended — no one to open</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nobody to open</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Records your visit and sends the client the "no one to open" message by email and WhatsApp.</p>
        {jobs.length === 0 ? <p className="text-sm text-muted-foreground">No jobs for you today.</p> : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {jobs.map((j) => (
              <li key={j.id}><button type="button" onClick={() => setJobId(j.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${jobId === j.id ? "border-primary bg-primary/10" : ""}`}>
                <span className="font-medium text-foreground">#{j.job_number} · {j.clients?.name}</span><span className="block text-muted-foreground">{j.sites?.name ?? "No site"}</span>
              </button></li>
            ))}
          </ul>
        )}
        <Textarea rows={2} placeholder="Optional note (e.g. rang the bell twice, called contact)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button className="h-11" disabled={busy || !jobId} onClick={go}>Record visit & notify client</Button>
      </DialogContent>
    </Dialog>
  );
}

type Sheet = { id: string; departure_status: string; departure_note: string | null; signature_data: string | null; return_fee_waived?: boolean };

/** Inside an unsigned job sheet: technician asks to leave, manager approves and the client is told the lift is left off. */
export function DepartureRequest({ sheet, manager, onChange, preapproved = false }: { sheet: Sheet; manager: boolean; onChange: () => void; preapproved?: boolean }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [waive, setWaive] = useState(false);
  const enabled = useNoticeEnabled("unsigned_left");
  if (preapproved && !sheet.signature_data) return <p className="mt-4 border-t pt-3 text-sm text-success">Unattended site — pre-approved to leave without signature. Save this sheet as a draft for signing later.</p>;
  if (sheet.signature_data || (!enabled && sheet.departure_status === "none")) return null;
  const set = async (departure_status: string, extra: Record<string, unknown> = {}) => {
    const { error } = await supabase.from("job_sheets").update({ departure_status, ...extra }).eq("id", sheet.id);
    if (error) throw error;
  };
  const run = (f: () => Promise<void>) => async () => { setBusy(true); try { await f(); onChange(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  const request = run(async () => {
    if (!note.trim()) throw new Error("Say why you are leaving (e.g. client left, equipment switched off at isolator)");
    await set("requested", { departure_note: note.trim() });
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    toast.success("Approval requested — wait on site for a supervisor or office admin");
  });
  const approve = run(async () => { await set("approved", { return_fee_waived: waive, return_fee_hours: waive ? 0 : RETURN_FEE_MIN_HOURS }); report((await sendClientNotice({ data: { sheetId: sheet.id, event: "unsigned_left" } })).result); });
  const reject = run(async () => { await set("rejected"); toast.success("Request declined — technician will wait for the client"); });

  const s = sheet.departure_status;
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground"><LogOut className="h-4 w-4" />Client left before signing?</p>
      {s === "requested" && <>
        <p className="text-sm text-muted-foreground">Waiting for approval to leave. Reason: {sheet.departure_note}</p>
        {manager && <label className="flex items-center gap-2 text-sm text-foreground"><Checkbox checked={waive} onCheckedChange={(b) => setWaive(!!b)} />Waive the 1 h return-visit charge</label>}
        {manager && <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={approve}><Check className="mr-1 h-4 w-4" />Approve & notify client</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={reject}><X className="mr-1 h-4 w-4" />Decline — wait on site</Button>
        </div>}
      </>}
      {s === "approved" && <p className="text-sm text-success">Departure approved — the client was asked to call to sign and restore service.</p>}
      {s === "approved" && <p className="text-xs text-muted-foreground">{sheet.return_fee_waived ? "Return-visit charge waived." : "A 1 h return-visit charge was added for billing."}</p>}
      {(s === "none" || s === "rejected") && <>
        {s === "rejected" && <p className="text-sm text-destructive">Last request was declined — please wait for the client.</p>}
        <p className="text-xs text-muted-foreground">A supervisor or office admin must approve before you leave. Once approved, the client gets the "left unsigned" message.</p>
        <Textarea rows={2} placeholder="What happened? e.g. client left at 14:30, equipment switched off at main isolator" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="outline" disabled={busy} onClick={request}>Ask approval to leave unsigned</Button>
      </>}
    </div>
  );
}

/** Manager dashboard list of technicians waiting to leave an unsigned site — urgent, with a quick reply to the technician. */
export function DepartureRequests() {
  const [reply, setReply] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["departure-requests"], refetchInterval: 20000,
    queryFn: async () => (await supabase.from("job_sheets").select("id, jobsheet_number, departure_note, departure_requested_at, clients(name), users!job_sheets_assigned_technician_id_fkey(full_name)").eq("departure_status", "requested").order("departure_requested_at")).data ?? [],
  });
  const sendReply = async (id: string) => {
    const text = (reply[id] ?? "").trim();
    if (!text) return;
    setSending(id);
    try {
      const { error } = await supabase.from("job_sheets").update({ departure_reply: text }).eq("id", id);
      if (error) throw error;
      setReply((r) => ({ ...r, [id]: "" }));
      toast.success("Message sent to the technician");
    } catch (e) { toast.error((e as Error).message); } finally { setSending(null); }
  };
  if (!data.length) return null;
  return (
    <section className="rounded-xl border-2 border-destructive bg-destructive/10 p-4">
      <h2 className="mb-2 flex items-center gap-2 font-medium text-foreground">
        <span className="inline-flex animate-pulse items-center rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">Urgent</span>
        Technicians waiting to leave unsigned ({data.length})
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">A technician is standing by on site — approve, decline or send a message right away.</p>
      <ul className="space-y-2">
        {data.map((s) => {
          const waiting = s.departure_requested_at ? Math.max(0, Math.round((Date.now() - new Date(s.departure_requested_at).getTime()) / 60000)) : null;
          return (
          <li key={s.id} className="rounded-lg bg-card p-3 text-sm">
            <Link to="/sheets/$sheetId" params={{ sheetId: s.id }} className="block">
              <span className="font-medium text-foreground">Job sheet- {s.jobsheet_number} · {s.clients?.name}</span>
              {waiting != null && <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">waiting {waiting} min</span>}
              <span className="block text-muted-foreground">{s.users?.full_name}: {s.departure_note}</span>
            </Link>
            <div className="mt-2 flex gap-2">
              <Input value={reply[s.id] ?? ""} onChange={(e) => setReply((r) => ({ ...r, [s.id]: e.target.value }))}
                placeholder='Message the technician, e.g. "Give me a minute to reach out to the client"'
                className="h-9 text-sm" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendReply(s.id); } }} />
              <Button size="sm" variant="outline" disabled={sending === s.id || !(reply[s.id] ?? "").trim()} onClick={() => void sendReply(s.id)}>Send</Button>
            </div>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
