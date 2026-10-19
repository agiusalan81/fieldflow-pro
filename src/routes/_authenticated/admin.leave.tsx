import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { approvalBalance } from "@/lib/jobsheets";
import { useProfile } from "@/lib/profile";
import { canDecideLeave, type AppRole } from "@/lib/field-rules";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/leave")({
  head: () => ({
    meta: [
      { title: "Leave approvals — FieldOps" },
      { name: "description", content: "Approve team leave with each applicant's balance, and see the team calendar." },
      { property: "og:title", content: "Leave approvals — FieldOps" },
      { property: "og:description", content: "Team leave approvals and calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaveApprovals,
});

const STATUS_CLS: Record<string, string> = { pending: "bg-warning/25 text-warning-foreground", approved: "bg-success/15 text-success", rejected: "bg-destructive/10 text-destructive" };

function LeaveApprovals() {
  const qc = useQueryClient();
  const { data: me } = useProfile();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const { data: reqs = [] } = useQuery({
    queryKey: ["leave", "team"],
    queryFn: async () => { const { data, error } = await supabase.from("leave_requests").select("*, users(full_name, role)").order("start_date"); if (error) throw error; return data; },
  });
  const { data: bals = [] } = useQuery({ queryKey: ["leave-balances-team"], queryFn: async () => (await supabase.from("user_leave_balances").select("*")).data ?? [] });

  const balanceOf = (uid: string) => {
    const b = bals.find((x) => x.user_id === uid);
    const annual = reqs.filter((r) => r.user_id === uid && r.leave_type === "Annual");
    return {
      base: Number(b?.base_entitlement_hours ?? 192), ph: Number(b?.public_holiday_credit_hours ?? 0),
      carried: b?.carried_forward_year===new Date().getFullYear()?Number(b.carried_forward_hours):0,
      taken: annual.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.total_hours), 0),
      pending: annual.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.total_hours), 0),
    };
  };
  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Leave approved" : "Leave rejected");
    qc.invalidateQueries({ queryKey: ["leave"] });
  };
  const openCert = async (path: string) => {
    const { data, error } = await supabase.storage.from("leave-certificates").createSignedUrl(path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const pending = reqs.filter((r) => r.status === "pending");
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const iso = (d: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const onDay = (d: number) => reqs.filter((r) => r.start_date <= iso(d) && r.end_date >= iso(d));

  return (
    <AppShell title="Leave approvals">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-medium text-foreground">Awaiting approval ({pending.length})</h2>
          {pending.length === 0 ? <EmptyState>Nothing to approve.</EmptyState> : (
            <ul className="space-y-2">
              {pending.map((r) => {
                const isAnnual = r.leave_type === "Annual";
                const bal = approvalBalance(balanceOf(r.user_id), isAnnual ? Number(r.total_hours) : 0);
                return (
                  <li key={r.id} className="space-y-2 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{r.users?.full_name} <span className="text-xs capitalize text-muted-foreground">· {r.users?.role}</span> · {r.leave_type}</p>
                      <p className="text-xs text-muted-foreground">{r.start_date} → {r.end_date} · {Number(r.total_hours).toFixed(2)} h
                        {r.medical_certificate_path && <button className="ml-1 text-primary underline" onClick={() => openCert(r.medical_certificate_path!)}>certificate</button>}</p>
                      {r.optional_notes && <p className="mt-1 text-xs text-foreground">“{r.optional_notes}”</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">{bal.available.toFixed(2)} h available</span>
                      {isAnnual && <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">{bal.after.toFixed(2)} h after this</span>}
                      {bal.exceedsBy > 0 && <span className="rounded-full bg-warning/25 px-2 py-0.5 text-warning-foreground">Exceeds balance by {bal.exceedsBy.toFixed(2)} h</span>}
                    </div>
                    {me && canDecideLeave(me.real_role as AppRole, (r.users?.role ?? "technician") as AppRole, r.user_id === me.id) ? <div className="flex gap-1">
                      <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                    </div> : <p className="text-xs text-muted-foreground">{r.user_id === me?.id ? "Your own request — an Office Admin decides this." : "Awaiting an Office Admin decision."}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

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
                  {list.slice(0, 2).map((r) => <p key={r.id} className={`mt-0.5 truncate rounded px-1 text-[10px] ${r.status === "rejected" ? "bg-destructive/15 text-destructive line-through" : STATUS_CLS[r.status]}`}>{r.users?.full_name?.split(" ")[0]}</p>)}
                  {list.length > 2 && <p className="text-[10px]">+{list.length - 2}</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
            <span className={`rounded px-1 ${STATUS_CLS["approved"]}`}>Approved</span><span className={`rounded px-1 ${STATUS_CLS["pending"]}`}>Pending</span><span className="rounded bg-destructive/15 px-1 text-destructive line-through">Rejected</span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
