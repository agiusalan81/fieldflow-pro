import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyUsers, isManager, ROLE_LABEL } from "@/lib/profile";
import { dwrEligible } from '@/lib/testing-rules';
import { usePreviewProfile } from "@/lib/impersonation";
import { downloadDwr } from "@/lib/dwr-report";
import type { DwrRow } from "@/lib/dwr";
import { downloadCsv, hoursCsv, type HoursExportRow } from "@/lib/hours-export";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dwr")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Daily works reports — FieldBridge" },
      { name: "description", content: "Daily works reports filed at clock-out: sites, job sheets, other work, breaks and overtime." },
      { property: "og:title", content: "Daily works reports — FieldBridge" },
      { property: "og:description", content: "Every technician's day, filed at clock-out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DwrPage,
});

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const t = (s: string) => new Date(s).toTimeString().slice(0, 5);

function DwrPage() {
  const { data: profile, isPreview } = usePreviewProfile();
  const { data: users = [] } = useCompanyUsers();
  const manager = isManager(profile) && !isPreview;
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return iso(d); });
  const [to, setTo] = useState(() => iso(new Date()));
  const [tech, setTech] = useState("all");
  const [otOnly, setOtOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data: reports = [] } = useQuery({
    queryKey: ["dwr", "list", from, to, tech, manager, profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile) return [];
      let q = supabase.from("daily_work_reports").select("*, users(full_name, employee_id)").gte("report_date", from).lte("report_date", to).order("report_date", { ascending: false }).order("shift_start", { ascending: false });
      if (!manager) q = q.eq("user_id", profile.id);
      else if (tech !== "all") q = q.eq("user_id", tech);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const list = otOnly ? reports.filter((r) => Number(r.ot15_hours) + Number(r.ot20_hours) > 0) : reports;
  const company = profile?.companies?.name ?? "";
  const quick = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); setFrom(iso(d)); setTo(iso(new Date())); };

  return (
    <AppShell title={manager ? "Daily works reports" : "My daily reports · History"}>
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" className="h-10" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" className="h-10" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {manager && (
            <div className="space-y-1"><Label className="text-xs">Field staff</Label>
              <Select value={tech} onValueChange={setTech}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All technicians & supervisors</SelectItem>{users.filter(u => dwrEligible(u.role)).map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name} · {ROLE_LABEL[u.role]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => quick(0)}>Today</Button>
            <Button size="sm" variant="ghost" onClick={() => quick(7)}>7 days</Button>
            <Button size="sm" variant="ghost" onClick={() => quick(30)}>30 days</Button>
          </div>
          {manager && <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={otOnly} onChange={(e) => setOtOnly(e.target.checked)} />With overtime only</label>}
        </section>
        {manager && list.length > 0 && <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => downloadCsv(hoursCsv(list as unknown as HoursExportRow[]), `Hours_DWR_${from}_${to}.csv`)}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div>}

        {list.length === 0 ? <EmptyState>No daily works reports in this range. A report is filed each time someone clocks out.</EmptyState> : (
          <ul className="space-y-2">
            {list.map((r) => {
              const rows = (Array.isArray(r.rows) ? r.rows : []) as DwrRow[];
              const ot = Number(r.ot15_hours) + Number(r.ot20_hours);
              return (
                <li key={r.id} className="rounded-xl border bg-card">
                  <button type="button" className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <span className="font-medium text-foreground">{new Date(r.report_date + "T00:00").toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</span>
                    {manager && <span className="text-foreground">{r.users?.full_name}</span>}
                    <span className="text-sm tabular-nums text-muted-foreground">{t(r.shift_start)}–{t(r.shift_end)}</span>
                    <span className="text-sm text-muted-foreground">{rows.filter((x) => x.kind === "job").length} job sheet(s) · {rows.filter((x) => x.kind === "internal").length} other</span>
                    <span className="ml-auto text-sm tabular-nums text-foreground">{Number(r.worked_hours).toFixed(2)} h{ot > 0 ? <span className="ml-2 rounded-full bg-warning/25 px-2 py-0.5 text-xs">OT {ot.toFixed(2)} h</span> : null}</span>
                  </button>
                  {open === r.id && (
                    <div className="border-t p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 pr-3">Time</th><th className="pr-3">Activity</th><th className="pr-3">Client / site / location</th><th>Notes</th></tr></thead>
                          <tbody>
                            {rows.map((x, i) => (
                              <tr key={i} className={`border-t ${x.kind === "break" ? "text-muted-foreground" : "text-foreground"}`}>
                                <td className="py-1.5 pr-3 tabular-nums">{x.from}–{x.to}</td><td className="pr-3">{x.title}</td><td className="pr-3">{x.place}</td><td>{x.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>Break {r.break_minutes} min</span><span>Standard {Number(r.standard_hours).toFixed(2)} h</span><span>1.5× {Number(r.ot15_hours).toFixed(2)} h</span><span>2× {Number(r.ot20_hours).toFixed(2)} h</span>
                        <Button size="sm" variant="outline" className="ml-auto" onClick={() => downloadDwr(r, company)}><Download className="mr-1 h-4 w-4" />PDF</Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
