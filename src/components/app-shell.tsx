import { usePlanFeatures, resolveAppTitle } from "@/lib/plan-features";
import { DepartureAlerts } from "@/components/client-notices";
import { LocationSharing } from "@/components/location-sharing";
import { PayrollSetupAlert } from "@/components/payroll-setup-alert";
import { syncReceipts } from "@/lib/receipt-queue";
import { WelcomeGuide } from "@/components/welcome-guide";
import { setTenantLocale } from "@/lib/locale";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, MapPin, ClipboardList, Clock, MessageSquare, CalendarDays, Users, SlidersHorizontal, Package, LogOut, Menu, Plus, CalendarClock, Settings, Building2, FileSignature, Hammer, Calculator, PhoneCall, FileText, UserCheck, ChevronDown, HelpCircle, Send, RotateCcw, MoreHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager, isOffice, setViewAs, ROLE_LABEL, type ViewAs } from "@/lib/profile";
import { useCan, type ModuleKey } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useCompanyRules, applyTypography } from "@/lib/company";
import { appearanceVariables, industrySheetLabel } from "@/lib/branding";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader, SheetDescription } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IdleLogout } from "@/components/idle-logout";
import { NotificationSounds, ProfileCompletionGate } from "@/components/member-alerts";
import { helpFor, searchHelp, type HelpGuide } from "@/lib/help-guides";
import { Input } from "@/components/ui/input";
import { QUICK_DEFAULTS, MENU_ONLY, rankActions, readUsage, recordUsage, resetUsage } from "@/lib/quick-actions";
import { useUserPreview, clearUserPreview } from "@/lib/impersonation";
import { UserPreviewControl, UserPreviewBanner } from "@/components/user-preview";

type NavItem = { to: string; label: string; icon: typeof Clock; module?: ModuleKey; office?: boolean; group: string; feature?: string };

const techNav: NavItem[] = [
  { group: "Field work", to: "/dashboard", label: "Today", icon: LayoutDashboard },
  { group: "Field work", to: "/sheets", label: "Job sheets", icon: ClipboardList },
  { group: "Field work", to: "/schedule", label: "Schedule", icon: CalendarClock },
  { group: "Field work", to: "/technical-library", label: "Technical library", icon: FileText, feature: "technical_library" },
  { group: "Field work", to: "/messages", label: "Team chat", icon: MessageSquare },
  { group: "Time & roster", to: "/dwr", label: "My daily reports", icon: FileText },
  { group: "Time & roster", to: "/standby", label: "Standby", icon: PhoneCall, feature: "standby" },
  { group: "Time & roster", to: "/leave", label: "Leave", icon: CalendarDays },
  { group: "Time & roster", to: "/hours", label: "My hours", icon: Clock },
  { group: "General", to: "/settings", label: "Settings", icon: Settings },
  { group: "General", to: "/subscription", label: "Billing & Plan", icon: Calculator },
];

const adminNav: NavItem[] = [
  { group: "Operations", to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { group: "Operations", to: "/technical-library", label: "Technical library", icon: FileText, feature: "technical_library" },
  { group: "Operations", to: "/admin/jobs", label: "Job sheets", icon: ClipboardList },
  { group: "Operations", to: "/pending-works", label: "Pending works", icon: Hammer, module: "pending_works" },
  { group: "Operations", to: "/admin/inventory", label: "Inventory", icon: Package, module: "inventory" },
  { group: "Team & roster", to: "/live-map", label: "Live team map", icon: MapPin },
  { group: "Team & roster", to: "/team", label: "Team", icon: UserCheck },
  { group: "Team & roster", to: "/team-invites", label: "Invites", icon: Send },
  { group: "Fleet Management", to: "/fleet", label: "Fleet Management", icon: MapPin, feature: "fleet_management" },
  { group: "Team & roster", to: "/standby", label: "Standby roster", icon: PhoneCall, feature: "standby" },
  { group: "Team & roster", to: "/dwr", label: "Daily works reports", icon: FileText },
  { group: "Team & roster", to: "/admin/leave", label: "Leave approvals", icon: CalendarDays, module: "leave_approvals" },
  { group: "Clients & commercial", to: "/admin/entities", label: "Clients & assets", icon: Users, module: "clients" },
  { group: "Clients & commercial", to: "/contracts", label: "Contracts", icon: FileSignature, module: "contracts", feature: "contracts" },
  { group: "Clients & commercial", to: "/estimates", label: "Estimates", icon: Calculator, module: "estimates", feature: "estimates" },
  { group: "My workspace", to: "/hours", label: "My hours", icon: Clock },
  { group: "My workspace", to: "/leave", label: "My leave", icon: CalendarDays },
  { group: "My workspace", to: "/messages", label: "Team chat", icon: MessageSquare },
  { group: "Administration", to: "/company", label: "Company", icon: Building2, module: "team" },
  { group: "Payroll", to: "/payroll/wages", label: "Employee wages setup", icon: Settings, office: true, feature: "payroll" },
  { group: "Payroll", to: "/payroll/hours", label: "Hours worked", icon: Clock, office: true, feature: "payroll" },
  { group: "Payroll", to: "/payroll/payslips", label: "Payslips", icon: Calculator, office: true, feature: "payroll" },
  { group: "Administration", to: "/admin/fields", label: "Fields & lookups", icon: SlidersHorizontal, module: "fields" },
  { group: "Administration", to: "/settings", label: "Settings", icon: Settings },
  { group: "Administration", to: "/subscription", label: "Billing & Plan", icon: Calculator },
];

/** Supervisors follow the technician menu for their own day, plus a team section. */
const supervisorNav: NavItem[] = [
  { group: "Field work", to: "/dashboard", label: "Today & team", icon: LayoutDashboard },
  { group: "Field work", to: "/sheets", label: "My job sheets", icon: ClipboardList },
  { group: "Field work", to: "/schedule", label: "My schedule", icon: CalendarClock },
  { group: "Field work", to: "/technical-library", label: "Technical library", icon: FileText, feature: "technical_library" },
  { group: "Field work", to: "/messages", label: "Team chat", icon: MessageSquare },
  { group: "Team", to: "/admin/jobs", label: "Team job sheets & dispatch", icon: Send },
  { group: "Team", to: "/live-map", label: "Live team map", icon: MapPin },
  { group: "Team", to: "/team", label: "Team", icon: UserCheck },
  { group: "Team", to: "/team-invites", label: "Invites", icon: Send },
  { group: "Fleet Management", to: "/fleet", label: "Fleet Management", icon: MapPin, feature: "fleet_management" },
  { group: "Team", to: "/standby", label: "Standby roster", icon: PhoneCall, feature: "standby" },
  { group: "Team", to: "/admin/leave", label: "Leave approvals", icon: CalendarDays, module: "leave_approvals" },
  { group: "Team", to: "/pending-works", label: "Pending works", icon: Hammer, module: "pending_works" },
  { group: "Clients & estimates", to: "/admin/entities", label: "Clients & assets", icon: Users, module: "clients" },
  { group: "Clients & estimates", to: "/estimates", label: "Estimates", icon: Calculator, module: "estimates", feature: "estimates" },
  { group: "Clients & estimates", to: "/admin/inventory", label: "Inventory", icon: Package, module: "inventory" },
  { group: "Time & roster", to: "/dwr", label: "Daily reports", icon: FileText },
  { group: "Time & roster", to: "/leave", label: "My leave", icon: CalendarDays },
  { group: "Time & roster", to: "/hours", label: "My hours", icon: Clock },
  { group: "General", to: "/settings", label: "Settings", icon: Settings },
];

/** Extra quick-action shortcuts that aren't menu items. */
const EXTRA: Record<string, { label: string; icon: typeof Clock; manager?: boolean }> = {
  "/sheets/new": { label: "New job sheet", icon: Plus },
  "/admin/jobs?new=true": { label: "Dispatch / schedule visit", icon: Send, manager: true },
};

const isActive = (path: string, to: string) => (to === "/dashboard" ? path === to : path === to || path.startsWith(to + "/"));

function NavLinks({ items, onNavigate, uid }: { items: NavItem[]; onNavigate?: () => void; uid?: string | undefined }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const groups = [...new Set(items.map((i) => i.group))];
  const activeGroup = items.find((i) => isActive(path, i.to))?.group ?? groups[0];
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroup);
  useEffect(() => { setOpenGroup(activeGroup); }, [activeGroup]);
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {groups.map((g) => {
        const open = openGroup === g;
        return (
          <div key={g}>
            <button type="button" aria-expanded={open} onClick={() => setOpenGroup(open ? undefined : g)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              {g}<ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </button>
            {open && (
              <div className="mb-1 flex flex-col gap-0.5 pl-1">
                {items.filter((i) => i.group === g).map((i) => (
                  <Link key={i.to} to={i.to}
                    onClick={() => { if (uid) recordUsage(uid, i.to); onNavigate?.(); }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-medium" }}
                    activeOptions={{ exact: i.to === "/dashboard" }}>
                    <i.icon className="h-4 w-4 shrink-0" />{i.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function QuickLink({ to, uid, className, children }: { to: string; uid?: string | undefined; className: string; children: ReactNode }) {
  const [p, q] = to.split("?");
  return (
    <Link to={p ?? "/dashboard"} search={q ? { new: true } as never : {} as never} className={className} onClick={() => uid && recordUsage(uid, to)}>
      {children}
    </Link>
  );
}

/** Mobile button dashboard: role starters, reordered by the user's own most-tapped screens. */
function QuickActions({ items, uid, role, manager }: { items: NavItem[]; uid: string; role: keyof typeof QUICK_DEFAULTS; manager: boolean }) {
  const [usage, setUsage] = useState<Record<string, number>>({});
  useEffect(() => { setUsage(readUsage(uid)); }, [uid]);
  const meta = (to: string) => EXTRA[to] ?? items.find((i) => i.to === to);
  const allowed = [...Object.keys(EXTRA).filter((k) => !EXTRA[k]?.manager || manager), ...items.map((i) => i.to).filter((t) => t !== "/dashboard" && !(MENU_ONLY[role] ?? []).includes(t))];
  const list = rankActions(QUICK_DEFAULTS[role].filter((t) => t !== "/dashboard"), allowed, usage, 6);
  return (
    <section className="mb-5 lg:hidden">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>
        {Object.keys(usage).length > 0 && <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground" onClick={() => { resetUsage(uid); setUsage({}); }}><RotateCcw className="h-3 w-3" />Reset</button>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {list.map((to) => { const m = meta(to); if (!m) return null; return (
          <QuickLink key={to} to={to} uid={uid} className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-2 text-center text-xs font-medium text-foreground active:bg-accent">
            <m.icon className="h-6 w-6 text-primary" />{m.label}
          </QuickLink>
        ); })}
      </div>
    </section>
  );
}

function GuideBody({ g }: { g: HelpGuide }) {
  return (
    <div className="space-y-4">
      <div><p className="mb-2 font-medium text-foreground">How to use it</p><ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
      {g.roles && <div><p className="mb-1 font-medium text-foreground">Who can do what</p><p className="text-muted-foreground">{g.roles}</p></div>}
      {g.tips?.length ? <div><p className="mb-1 font-medium text-foreground">Tips</p><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{g.tips.map((t) => <li key={t}>{t}</li>)}</ul></div> : null}
    </div>
  );
}

function HelpButton() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const g = helpFor(path);
  const [q, setQ] = useState("");
  const results = searchHelp(q);
  return (
    <Sheet onOpenChange={(o) => { if (!o) setQ(""); }}>
      <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Help"><HelpCircle className="h-5 w-5" /></Button></SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>Help{!q && g ? ` · ${g.title}` : ""}</SheetTitle><SheetDescription>{!q && g ? g.purpose : "Search every help guide."}</SheetDescription></SheetHeader>
        <div className="mt-2 space-y-5 px-4 pb-6 text-sm">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help (e.g. clock in, travel, waze, receipt, standby)…" aria-label="Search help" />
          {q ? (results.length ? results.map((r) => (
            <section key={r.path} className="space-y-2 border-b pb-4">
              <Link to={r.path} className="font-medium text-primary underline-offset-2 hover:underline">{r.guide.title}</Link>
              <p className="text-muted-foreground">{r.guide.purpose}</p>
              <GuideBody g={r.guide} />
            </section>
          )) : <p className="text-muted-foreground">No help matches “{q}”.</p>) : g ? <GuideBody g={g} /> : <p className="text-muted-foreground">Type above to search the help guides.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { data: actor } = useProfile();
  const preview = useUserPreview(actor);
  const profile = actor && preview.member ? { ...actor, role: preview.member.role } : actor;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const manager = isManager(profile);
  const can = useCan(profile);
  const planOn = usePlanFeatures(!!actor);
  const office = isOffice(profile);
  const extraNav: NavItem[] = [];
  const baseItems = [...(profile?.role === "supervisor" ? supervisorNav : manager ? adminNav : techNav), ...extraNav].filter((i) => (i.to !== "/subscription" || profile?.role === "superuser") && (i.to !== "/company" || office) && (!i.office || office) && (!i.module || can(i.module) || (i.to === "/company" && office)) && (!i.feature || planOn(i.feature)));
  const canSwitch = profile && profile.real_role !== "technician" && !preview.active;

  const { data: company } = useCompanyRules();
  const items = baseItems.map(i => ({ ...i, label: industrySheetLabel(company?.appearance.industryPreset ?? "general", i.label) }));
  const appTitle = resolveAppTitle(company?.appTitle, planOn("custom_app_title"));
  useEffect(() => { applyTypography(company?.theme); return () => applyTypography(undefined); }, [company?.theme]);
  useEffect(() => {
    const source = company?.theme.customFontData; if (!source) return;
    let active = true; let face: FontFace | undefined;
    void new FontFace("FieldBridgeCompany", `url("${source}")`).load().then(f => { if (active) { face = f; document.fonts.add(f); } }).catch(() => {});
    return () => { active = false; if (face) document.fonts.delete(face); };
  }, [company?.theme.customFontData]);
  if (company) setTenantLocale(company.locale ?? {});
  useEffect(() => {
    document.documentElement.classList.toggle("dark", profile?.app_theme_preference === "dark");
  }, [profile?.app_theme_preference]);

  useEffect(() => { if (!actor || preview.active) return; const sync = () => { void syncReceipts(actor.id).catch(() => {}); }; sync(); window.addEventListener("online", sync); return () => window.removeEventListener("online", sync); }, [actor?.id, preview.active]);

  const signOut = async () => {
    clearUserPreview();
    setViewAs(null);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const brand = (
    <div className="flex items-center gap-3 px-3">
      {company?.logo && <img src={company.logo} alt="" className="h-10 w-10 shrink-0 rounded-md bg-card object-contain p-0.5" />}
      <div className="min-w-0">
        <p className="truncate font-display text-xl text-sidebar-foreground">{appTitle}</p>
        <p className="truncate text-xs text-sidebar-foreground/60">{profile?.companies?.name ?? "—"}</p>
      </div>
    </div>
  );
  const footer = (
    <div className="mt-auto border-t border-sidebar-border px-3 pt-4">
      <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
      <p className="text-xs capitalize text-sidebar-foreground/60">{profile ? ROLE_LABEL[profile.role] : ""}</p>
      <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );

  const second = manager ? { to: "/team", label: "Team", icon: UserCheck } : { to: "/schedule", label: "Schedule", icon: CalendarClock };
  const tab = "flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground";

  return (
    <div style={company ? appearanceVariables(company.appearance) : undefined} data-icons={company?.appearance.iconPreset} data-company-font={company?.theme.customFontData ? "on" : undefined} className="tenant-experience min-h-screen bg-background lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {actor && !preview.active && <NotificationSounds profile={actor} />}
      {profile && company && <IdleLogout userId={profile.id} realRole={profile.real_role} timeoutMin={company.idleTimeout} />}
      <aside className="tenant-menu sticky top-0 hidden h-screen flex-col gap-6 border-r border-sidebar-border bg-sidebar py-6 px-3 lg:flex">
        {brand}
        <NavLinks items={items} uid={profile?.id} />
        {footer}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" style={company ? appearanceVariables(company.appearance) : undefined} data-icons={company?.appearance.iconPreset} className="tenant-menu tenant-experience flex w-72 flex-col gap-6 bg-sidebar py-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {brand}
              <NavLinks items={items} uid={profile?.id} onNavigate={() => setMenuOpen(false)} />
              {footer}
            </SheetContent>
          </Sheet>
          <h1 className="min-w-0 flex-1 truncate font-display text-xl text-foreground sm:text-2xl">{title}</h1>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            <HelpButton />
            {actor && !preview.active && actor.role === actor.real_role && <WelcomeGuide profile={actor} allowed={items.map(i=>i.to)} />}
            <UserPreviewControl />
            {canSwitch && (
              <Select value={profile.role} onValueChange={(v) => { setViewAs(v === profile.real_role ? null : (v as ViewAs)); navigate({ to: "/dashboard" }); }}>
                <SelectTrigger className="h-9 w-[150px] border-dashed text-xs" aria-label="View As mode"><span className="hidden text-muted-foreground xl:inline">View as:&nbsp;</span><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superuser">Superuser</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Office Admin</SelectItem>
                </SelectContent>
              </Select>
            )}
            {!preview.active && actions}
            {!preview.active && <Button asChild size="sm" variant={actions ? "outline" : "default"} className="hidden sm:inline-flex">
              <Link to="/sheets/new" search={{}}><Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Create New Job Sheet</span></Link>
            </Button>}
          </div>
        </header>
        <UserPreviewBanner />
        {actor && !preview.active && <ProfileCompletionGate profile={actor} />}
        <main className="tenant-workspace flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {actor && !preview.active && <DepartureAlerts userId={actor.id} />}
          {profile && path === "/dashboard" && !preview.active && <QuickActions items={items} uid={profile.id} role={profile.role} manager={manager} />}
          {!preview.active && <LocationSharing />}
          {path === "/dashboard" && !preview.active && office && <PayrollSetupAlert />}
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t bg-card lg:hidden">
        <Link to="/dashboard" className={tab} activeProps={{ className: "text-primary font-medium" }} activeOptions={{ exact: true }}><LayoutDashboard className="h-5 w-5" />Home</Link>
        <Link to={manager ? "/admin/jobs" : "/sheets"} className={tab} activeProps={{ className: "text-primary font-medium" }}><ClipboardList className="h-5 w-5" />Job sheets</Link>
        {preview.active ? <Link to="/hours" className={tab}><Clock className="h-5 w-5" />Hours</Link> : <Link to="/sheets/new" search={{}} aria-label="Create new job sheet" className="mx-auto -mt-5 mb-1.5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"><Plus className="h-7 w-7" /></Link>}
        <Link to={second.to} className={tab} activeProps={{ className: "text-primary font-medium" }}><second.icon className="h-5 w-5" />{second.label}</Link>
        <button type="button" className={tab} onClick={() => setMenuOpen(true)}><MoreHorizontal className="h-5 w-5" />More</button>
      </nav>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: "border border-dashed text-muted-foreground",
    pending: "bg-muted text-muted-foreground",
    in_transit: "bg-warning/25 text-warning-foreground",
    in_progress: "bg-primary/15 text-primary",
    completed: "bg-success/15 text-success",
  };
  const label: Record<string, string> = { draft: "Draft", pending: "Pending", in_transit: "In transit", in_progress: "In progress", completed: "Completed" };
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[status] ?? ""}`}>{label[status] ?? status}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

/** Goes back one step in browser history; falls back to a given page when opened directly. */
export function BackButton({ fallback = "/dashboard" }: { fallback?: string }) {
  const navigate = useNavigate();
  return (
    <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: fallback }))}>
      <ArrowLeft className="mr-1 h-4 w-4" />Back
    </Button>
  );
}
