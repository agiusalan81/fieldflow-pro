import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({
    meta: [
      { title: "Leave — FieldOps" },
      { name: "description", content: "Request leave and approve team leave on a calendar." },
      { property: "og:title", content: "Leave — FieldOps" },
      { property: "og:description", content: "Leave requests and approvals." },
    ],
  }),
  component: LeavePage,
});

const STATUS_CLS: Record<string, string> = {
  pending: "bg-warning/25 text-warning-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

function LeavePage() {
  const { data: profile } = useProfile();
  const manager = isManager(profile);
  const qc = useQueryClient();
  const [range, setRange] = useState({ start_date: "", end_date: "" });
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const { data: reqs = [] } = useQuery({
    queryKey: ["leave"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_requests").select("*, users(full_name)").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase.from("leave_requests").insert({ ...range, company_id: profile.company_id, user_id: profile.id });
    if (error) return toast.error(error.message);
    toast.success("Leave requested");
    setRange({ start_date: "", end_date: "" });
    qc.invalidateQueries({ queryKey: ["leave"] });
  };
  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["leave"] });
  };

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const iso = (d: number) => new Date(Date.UTC(month.getFullYear(), month.getMonth(), d)).toISOString().slice(0, 10);
  const onDay = (d: number) => reqs.filter((r) => r.status !== "rejected" && r.start_date <= iso(d) && r.end_date >= iso(d));
  const pending = reqs.filter((r) => r.status === "pending");

  return (
    <AppShell title="Leave">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-foreground">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
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
                  <div className="mt-0.5 space-y-0.5">
                    {list.slice(0, 2).map((r) => (
                      <p key={r.id} className={`truncate rounded px-1 text-[10px] ${STATUS_CLS[r.status]}`}>{r.users?.full_name?.split(" ")[0]}</p>
                    ))}
                    {list.length > 2 && <p className="text-[10px]">+{list.length - 2}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-5">
          <form onSubmit={request} className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-medium text-foreground">Request leave</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>From</Label><Input className="h-11" type="date" required value={range.start_date} onChange={(e) => setRange({ ...range, start_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>To</Label><Input className="h-11" type="date" required min={range.start_date} value={range.end_date} onChange={(e) => setRange({ ...range, end_date: e.target.value })} /></div>
            </div>
            <Button type="submit" className="h-11 w-full">Submit request</Button>
          </form>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-medium text-foreground">{manager ? `Awaiting approval (${pending.length})` : "My requests"}</h2>
            {(manager ? pending : reqs).length === 0 ? <EmptyState>Nothing here.</EmptyState> : (
              <ul className="space-y-2">
                {(manager ? pending : reqs).map((r) => (
                  <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{manager ? r.users?.full_name : `${r.start_date} → ${r.end_date}`}</p>
                      <p className="truncate text-xs text-muted-foreground">{manager ? `${r.start_date} → ${r.end_date}` : ""}</p>
                    </div>
                    {manager ? (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                      </div>
                    ) : <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_CLS[r.status]}`}>{r.status}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
