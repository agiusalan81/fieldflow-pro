import { MemberSkills } from "@/components/member-skills";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamManagement } from "@/components/team-management";
import { RegisteredMembers } from "@/components/registered-members";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager, ROLE_LABEL } from "@/lib/profile";
import { canSeeMember } from "@/lib/member-registration";
import type { Role } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import {AVAILABILITY_ORDER, activeAvailabilityMember, availabilityStatus, type Availability} from '@/lib/team-availability';

export const Route = createFileRoute("/_authenticated/team")({ staticData: { sitemap: false },
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

type Status = Availability;
const LABEL: Record<Status, string> = { clocked_in: "Available", travelling: "Travelling", standby: "On standby", sick: "Sick", leave: "On leave", off_shift: "Off shift" };
const CLS: Record<Status, string> = {
  clocked_in: "bg-success text-success-foreground", travelling: "bg-warning text-warning-foreground", standby: "bg-primary text-primary-foreground", sick: "bg-destructive/10 text-destructive",
  leave: "bg-primary/10 text-primary", off_shift: "bg-muted text-muted-foreground",
};

function LiveAvailability() {
  const { data: profile } = useProfile();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = useQuery({
    queryKey: ["team-availability", profile?.id, today],
    enabled: isManager(profile),
    refetchInterval: 30_000,
    queryFn: async () => {
      const [u, s, l] = await Promise.all([
        supabase.rpc("registered_members"),
        supabase.from("shifts").select("user_id, shift_type, started_at").is("ended_at", null),
        supabase.from("leave_requests").select("user_id, leave_type, end_date").eq("status", "approved").lte("start_date", today).gte("end_date", today),
      ]);
      if (u.error) throw u.error; if (s.error) throw s.error; if (l.error) throw l.error;
      return { users: (u.data ?? []).filter(u => activeAvailabilityMember(u.registration_status)), shifts: s.data ?? [], leave: l.data ?? [] };
    },
  });
  if (!isManager(profile)) return <AppShell title="Team availability"><EmptyState>Only supervisors and office staff can see team availability.</EmptyState></AppShell>;
  const statusOf = (id: string): { s: Status; sub: string } => {
    const lv = data?.leave.find((x) => x.user_id === id);
    const sh = data?.shifts.filter((x) => x.user_id === id) ?? [];
    const s = availabilityStatus(sh, lv?.leave_type, profile?.role === 'admin' || profile?.role === 'superuser');
    if (lv) return {s, sub: `until ${new Date(lv.end_date + "T00:00").toLocaleDateString()}`};
    const current = sh.find(x => x.shift_type === (s === 'travelling' ? 'travel' : s === 'standby' ? 'standby' : 'shift'));
    return {s, sub: current ? `since ${new Date(current.started_at).toTimeString().slice(0, 5)}` : ''};
  };
  const rows = (data?.users ?? []).filter((u) => activeAvailabilityMember(u.registration_status) && !!profile && canSeeMember(profile.role, u.role as Role)).map((u) => ({ u, ...statusOf(u.id) })).sort((a,b)=>AVAILABILITY_ORDER.indexOf(a.s)-AVAILABILITY_ORDER.indexOf(b.s)||a.u.full_name.localeCompare(b.u.full_name));
  const counts = (Object.keys(LABEL) as Status[]).map((k) => [k, rows.filter((r) => r.s === k).length] as const);
  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {counts.map(([k, n]) => <div key={k} className={`rounded-lg p-3 ${CLS[k]}`}><p className="font-display text-2xl">{n}</p><p className="text-xs">{LABEL[k]}</p></div>)}
        </div>
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map(({ u, s, sub }) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{u.full_name}</p><p className="text-xs capitalize text-muted-foreground">{ROLE_LABEL[u.role]}</p><MemberSkills userId={u.id} role={u.role} name={u.full_name} editable/></div>
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
  return <AppShell title="Team"><Tabs defaultValue="availability" className="mx-auto max-w-5xl"><TabsList className="h-auto flex-wrap"><TabsTrigger value="availability">Live Availability</TabsTrigger><TabsTrigger value="registered">Team members</TabsTrigger><TabsTrigger value="invites">Invites</TabsTrigger></TabsList><TabsContent value="availability" className="mt-4"><LiveAvailability /></TabsContent><TabsContent value="registered" className="mt-4"><RegisteredMembers role={profile.role} meId={profile.id}/></TabsContent>{(["invites"] as const).map(tab=><TabsContent key={tab} value={tab} className="mt-4"><TeamManagement role={profile.role} companyId={profile.company_id} meId={profile.id} tab={tab}/></TabsContent>)}</Tabs></AppShell>;
}
