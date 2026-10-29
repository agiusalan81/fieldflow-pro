import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePreviewProfile } from "@/lib/impersonation";
import { AppShell, EmptyState } from "@/components/app-shell";
import { OvertimeCard } from "@/components/work-extras";
import { ShiftTracker } from "./dashboard";
import { MyIncentives } from '@/components/my-incentives';

export const Route = createFileRoute("/_authenticated/hours")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "My hours — FieldBridge" },
      { name: "description", content: "Your standard and overtime hours worked out from shifts and job sheets." },
      { property: "og:title", content: "My hours — FieldBridge" },
      { property: "og:description", content: "Standard, 1.5× and 2× hours at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HoursPage,
});

function HoursPage() {
  const { data: profile } = usePreviewProfile();
  const { data: days = [] } = useQuery({
    queryKey: ["dwr", "mine-list", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase.from("daily_work_reports").select("id, report_date, shift_start, shift_end, break_minutes, worked_hours, standard_hours, ot15_hours, ot20_hours").eq("user_id", profile.id).order("report_date", { ascending: false }).limit(31);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!profile) return <AppShell title="My hours"><p className="text-muted-foreground">Loading…</p></AppShell>;
  const t = (s: string) => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <AppShell title="My hours">
      <div className="mx-auto max-w-4xl space-y-5">
        <ShiftTracker profile={profile} />
        <MyIncentives />
        <OvertimeCard userId={profile.id} />
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3"><h2 className="font-medium text-foreground">Day by day</h2><Link to="/dwr" className="text-sm text-primary">Daily reports</Link></div>
          {!days.length ? <div className="p-5"><EmptyState>No days filed yet. Your hours appear here after you clock out.</EmptyState></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="px-5 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Shift</th><th className="px-3 py-2 text-right font-medium">Break</th><th className="px-3 py-2 text-right font-medium">Std</th><th className="px-3 py-2 text-right font-medium">1.5×</th><th className="px-3 py-2 text-right font-medium">2×</th></tr></thead>
                <tbody className="divide-y">
                  {days.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-2.5 text-foreground">{new Date(d.report_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{t(d.shift_start)}–{t(d.shift_end)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{d.break_minutes}m</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{Number(d.standard_hours).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{Number(d.ot15_hours).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{Number(d.ot20_hours).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
