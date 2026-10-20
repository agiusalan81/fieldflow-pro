import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamManagement } from "@/components/team-management";
import { RegisteredMembers } from "@/components/registered-members";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team availability — FieldBridge" },
      { name: "description", content: "Who is clocked in, on leave, sick or available right now." },
      { property: "og:title", content: "Team availability — FieldBridge" },
      { property: "og:description", content: "Live availability of your team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

type Status = "clocked_in" | "travelling" | "sick" | "leave" | "available";
const LABEL: Record<Status, string> = { clocked_in: "Clocked in", travelling: "Travelling", sick: "Sick", leave: "On leave", available: "Available / off shift" };
const CLS: Record<Status, string> = {
  clocked_in: "bg-success/15 text-success", travelling: "bg-warning/25 text-foreground", sick: "bg-destructive/10 text-destructive",
  leave: "bg-primary/10 text-primary", available: "bg-muted text-muted-foreground",
};

function LiveAvailability() {
  const { data: profile } = useProfile();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = useQuery({
    queryKey: ["team-availability", today],
    enabled: isManager(profile),
    refetchInterval: 30_000,
    queryFn: async () => {
      const [u, s, l] = await Promise.all([
        supabase.from("users").select("id, full_name, role, phone_number").order("full_name"),
        supabase.from("shifts").select("user_id, shift_type, started_at").is("ended_at", null),
        supabase.from("leave_requests").select("user_id, leave_type, end_date").eq("status", "approved").lte("start_date", today).gte("end_date", today),
      ]);
      return { users: u.data ?? [], shifts: s.data ?? [], leave: l.data ?? [] };
    },
  });
  if (!isManager(profile)) return <AppShell title="Team availability"><EmptyState>Only supervisors and office staff can see team availability.</EmptyState></AppShell>;
  const statusOf = (id: string): { s: Status; sub: string } => {
    const lv = data?.leave.find((x) => x.user_id === id);
    if (lv) return { s: lv.leave_type === "Sick" && isManager(profile) ? "sick" : "leave", sub: `until ${new Date(lv.end_date + "T00:00").toLocaleDateString()}` };
    const sh = data?.shifts.filter((x) => x.user_id === id) ?? [];
    const tr = sh.find((x) => x.shift_type === "travel");
    const on = sh.find((x) => x.shift_type === "shift");
    if (tr) return { s: "travelling", sub: `since ${new Date(tr.started_at).toTimeString().slice(0, 5)}` };
    if (on) return { s: "clocked_in", sub: `since ${new Date(on.started_at).toTimeString().slice(0, 5)}` };
    return { s: "available", sub: "" };
  };
  const rows = (data?.users ?? []).map((u) => ({ u, ...statusOf(u.id) }));
  const counts = (Object.keys(LABEL) as Status[]).map((k) => [k, rows.filter((r) => r.s === k).length] as const);
  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {counts.map(([k, n]) => <div key={k} className="rounded-xl border bg-card p-3"><p className="font-display text-2xl text-foreground">{n}</p><p className="text-xs text-muted-foreground">{LABEL[k]}</p></div>)}
        </div>
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map(({ u, s, sub }) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{u.full_name}</p><p className="text-xs capitalize text-muted-foreground">{u.role}{u.phone_number ? ` · ${u.phone_number}` : ""}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CLS[s]}`}>{LABEL[s]}</span>
              <span className="w-24 text-right text-xs text-muted-foreground">{sub}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function TeamPage() {
 const { data: profile } = useProfile();
 if (!profile) return <AppShell title="Team"><p className="text-muted-foreground">Loading…</p></AppShell>;
 if (!isManager(profile)) return <AppShell title="Team"><EmptyState>Team management is available to supervisors and office staff.</EmptyState></AppShell>;
  return <AppShell title="Team"><Tabs defaultValue="availability" className="mx-auto max-w-5xl"><TabsList className="h-auto flex-wrap"><TabsTrigger value="availability">Live Availability</TabsTrigger><TabsTrigger value="roster">Team Roster</TabsTrigger><TabsTrigger value="registered">Registered Members</TabsTrigger><TabsTrigger value="invites">Invites</TabsTrigger></TabsList><TabsContent value="availability" className="mt-4"><LiveAvailability /></TabsContent><TabsContent value="registered" className="mt-4"><RegisteredMembers role={profile.role} meId={profile.id}/></TabsContent>{(["roster","invites"] as const).map(tab=><TabsContent key={tab} value={tab} className="mt-4"><TeamManagement role={profile.role} companyId={profile.company_id} meId={profile.id} tab={tab}/></TabsContent>)}</Tabs></AppShell>;
}
