import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager } from "@/lib/profile";
import { leaveHours, remainingBalance } from "@/lib/jobsheets";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({
    meta: [
      { title: "Book leave — FieldOps" },
      { name: "description", content: "See your leave balance, request leave and approve team leave." },
      { property: "og:title", content: "Book leave — FieldOps" },
      { property: "og:description", content: "Leave balance, requests and approvals." },
    ],
  }),
  component: LeavePage,
});

const STATUS_CLS: Record<string, string> = {
  pending: "bg-warning/25 text-warning-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function LeavePage() {
  const { data: profile } = useProfile();
  const manager = isManager(profile);
  const qc = useQueryClient();
  const [f, setF] = useState({ leave_type: "Annual", start_date: "", end_date: "", optional_notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const { data: reqs = [] } = useQuery({
    queryKey: ["leave"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_requests").select("*, users(full_name)").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: bal } = useQuery({
    queryKey: ["leave-balance", profile?.id],
    enabled: !!profile,
    queryFn: async () => (await supabase.from("user_leave_balances").select("*").eq("user_id", profile!.id).maybeSingle()).data,
  });

  const mine = reqs.filter((r) => r.user_id === profile?.id);
  const annual = mine.filter((r) => r.leave_type === "Annual");
  const b = {
    base: Number(bal?.base_entitlement_hours ?? 192),
    ph: Number(bal?.public_holiday_credit_hours ?? 0),
    taken: annual.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.total_hours), 0),
    pending: annual.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.total_hours), 0),
  };
  const remaining = remainingBalance(b);
  const requested = leaveHours(f.start_date, f.end_date);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (f.leave_type === "Sick" && !file) { toast.error("Sick leave needs a medical certificate"); return; }
    if (requested <= 0) { toast.error("Pick a date range with at least one weekday"); return; }
    if (f.leave_type === "Annual" && requested > remaining) { toast.error(`Only ${remaining.toFixed(2)} h left`); return; }
    setBusy(true);
    let path: string | null = null;
    if (file) {
      path = `${profile.company_id}/${profile.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("leave-certificates").upload(path, file);
      if (up.error) { setBusy(false); toast.error(up.error.message); return; }
    }
    const { error } = await supabase.from("leave_requests").insert({
      company_id: profile.company_id, user_id: profile.id, leave_type: f.leave_type, start_date: f.start_date, end_date: f.end_date,
      total_hours: requested, optional_notes: f.optional_notes || null, medical_certificate_path: path,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Leave requested");
    setF({ leave_type: "Annual", start_date: "", end_date: "", optional_notes: "" }); setFile(null);
    qc.invalidateQueries({ queryKey: ["leave"] });
  };
  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["leave"] });
  };
  const openCert = async (path: string) => {
    const { data, error } = await supabase.storage.from("leave-certificates").createSignedUrl(path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const iso = (d: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const onDay = (d: number) => reqs.filter((r) => r.status !== "rejected" && r.start_date <= iso(d) && r.end_date >= iso(d));
  const pending = reqs.filter((r) => r.status === "pending");

  return (
    <AppShell title="Book leave">
      <div className="space-y-5">
        <section className="rounded-xl border bg-card p-4">
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
            {[["Base", b.base], ["PH credit", b.ph], ["Taken", -b.taken], ["Pending", -b.pending]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-muted/60 p-2">
                <p className="text-[11px] text-muted-foreground">{l}</p>
                <p className="font-display text-lg tabular-nums text-foreground">{(v as number) < 0 ? "−" : ""}{Math.abs(v as number).toFixed(2)}</p>
              </div>
            ))}
            <div className="col-span-2 rounded-lg bg-primary p-2 text-primary-foreground sm:col-span-1">
              <p className="text-[11px] opacity-80">Remaining</p>
              <p className="font-display text-lg tabular-nums">{remaining.toFixed(2)} h</p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <form onSubmit={request} className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-medium text-foreground">Request leave</h2>
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <Select value={f.leave_type} onValueChange={(v) => setF({ ...f, leave_type: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{["Annual", "Sick", "Training", "Unpaid"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>From</Label><Input className="h-11" type="date" required value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>To</Label><Input className="h-11" type="date" required min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
            </div>
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">Requested: <strong className="tabular-nums">{requested.toFixed(2)} h</strong> <span className="text-muted-foreground">(8 h per weekday)</span></p>
            {f.leave_type === "Sick" && (
              <div className="space-y-1.5">
                <Label>Medical certificate *</Label>
                <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                  <Paperclip className="h-4 w-4 shrink-0" /><span className="truncate">{file ? file.name : "Attach photo or PDF"}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}
            <div className="space-y-1.5"><Label>Notes (optional)</Label><Textarea value={f.optional_notes} onChange={(e) => setF({ ...f, optional_notes: e.target.value })} /></div>
            <Button type="submit" className="h-11 w-full" disabled={busy}>Submit request</Button>
          </form>

          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3 font-medium text-foreground">My request history</h2>
            {mine.length === 0 ? <div className="p-5"><EmptyState>No requests yet.</EmptyState></div> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead className="text-right">Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {mine.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.leave_type}{r.medical_certificate_path && <button className="ml-1 text-primary" aria-label="View certificate" onClick={() => openCert(r.medical_certificate_path!)}><Paperclip className="inline h-3 w-3" /></button>}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.start_date} → {r.end_date}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(r.total_hours).toFixed(2)}</TableCell>
                        <TableCell><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[r.status]}`}>{cap(r.status)}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>

        {manager && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-medium text-foreground">Team calendar · {month.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
                {Array.from({ length: offset }).map((_, i) => <div key={"o" + i} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const list = onDay(i + 1);
                  return (
                    <div key={i} className="min-h-14 rounded-md border p-1 text-left sm:min-h-20">
                      <p className="text-[11px] text-foreground">{i + 1}</p>
                      {list.slice(0, 2).map((r) => <p key={r.id} className={`mt-0.5 truncate rounded px-1 text-[10px] ${STATUS_CLS[r.status]}`}>{r.users?.full_name?.split(" ")[0]}</p>)}
                      {list.length > 2 && <p className="text-[10px]">+{list.length - 2}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-3 font-medium text-foreground">Awaiting approval ({pending.length})</h2>
              {pending.length === 0 ? <EmptyState>Nothing to approve.</EmptyState> : (
                <ul className="space-y-2">
                  {pending.map((r) => (
                    <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{r.users?.full_name} · {r.leave_type}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.start_date} → {r.end_date} · {Number(r.total_hours)} h
                          {r.medical_certificate_path && <button className="ml-1 text-primary underline" onClick={() => openCert(r.medical_certificate_path!)}>certificate</button>}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
