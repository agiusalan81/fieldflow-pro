import { QrCode } from "lucide-react";
import { ActionNotifications, ChatBadge, OnCallBadge, QueueBadge } from "@/components/action-notifications";
import { usePlanFeatures, useLockedVisibility, useNavLock, resolveAppTitle } from "@/lib/plan-features";
import { DepartureAlerts } from "@/components/client-notices";
import { LocationSharing } from "@/components/location-sharing";
import { PayrollSetupAlert } from "@/components/payroll-setup-alert";
import { syncReceipts } from "@/lib/receipt-queue";
import { WelcomeGuide } from "@/components/welcome-guide";
import { WorkspaceCreate, WorkspaceSearch } from "@/components/workspace-tools";
import { organizeNavigation } from "@/lib/navigation-hubs";
import { useCrmAccess } from "@/lib/crm-access";
import { crmAllows } from "@/lib/crm";
import { showRoleMenuItem } from "@/lib/role-menu";
import { setTenantLocale } from "@/lib/locale";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, MapPin, ClipboardList, Clock, MessageSquare, CalendarDays, Users, SlidersHorizontal, Package, LogOut, Menu, Plus, CalendarClock, Settings, Building2, FileSignature, Hammer, Calculator, PhoneCall, FileText, UserCheck, ChevronDown, HelpCircle, Send, RotateCcw, MoreHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager, isOffice, setViewAs, canViewAsRoles, ROLE_LABEL, type ViewAs } from "@/lib/profile";
import { useCan, type ModuleKey } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useCompanyRules, applyTypography } from "@/lib/company";
import { appearanceVariables, industrySheetLabel, DEFAULT_APPEARANCE } from "@/lib/branding";
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
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { PlatformFeedback } from "@/components/platform-feedback";
import { LockedModule, ModulePreview, MODULE_ROUTE } from '@/components/module-preview';

type NavItem = { to: string; label: string; icon: typeof Clock; module?: ModuleKey; office?: boolean; group: string; feature?: string | undefined; locked?: boolean; soon?: boolean };

const techNav: NavItem[] = [
  { group: "Field work", to: "/dashboard", label: "Today & team", icon: LayoutDashboard },
  { group: "Field work", to: "/sheets", label: "My job sheets", icon: ClipboardList },
  { group: "Field work", to: "/surveys", label: "Site surveys", icon: ClipboardList, feature: "site_surveys" },
  { group: "Field work", to: "/schedule", label: "My schedule", icon: CalendarClock },
  { group: "Field work", to: "/expenses", label: "Log expense", icon: FileText, feature: "receipts" },
  { group: "Field work", to: "/technical-library", label: "Technical library", icon: FileText, feature: "technical_library" },
  { group: "Field work", to: "/available-jobs", label: "Available jobs", icon: Hammer, feature: "skills_dispatch" },
  { group: "Field work", to: "/messages", label: "Team chat", icon: MessageSquare },
  { group: "Field work", to: "/as-built", label: "Site survey", icon: Calculator, feature: "qs_pricing" },
  { group: "Time & roster", to: "/dwr", label: "My daily reports", icon: FileText },
  { group: "Time & roster", to: "/standby", label: "On-call rota", icon: PhoneCall, feature: "standby" },
  { group: "Time & roster", to: "/leave", label: "Leave", icon: CalendarDays },
  { group: "Time & roster", to: "/hours", label: "My hours", icon: Clock },
  { group: "General", to: "/settings", label: "Settings", icon: Settings },
  { group: "General", to: "/subscription", label: "Billing & Plan", icon: Calculator },
];

const adminNav: NavItem[] = [
  { group: "Operations", to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { group: "Operations", to: "/admin/jobs", label: "Job sheets", icon: ClipboardList },
  { group: "Operations", to: "/pending-works", label: "Pending Works", icon: Hammer, module: "pending_works" },
  { group: "Operations", to: "/expenses", label: "Expenses & receipts", icon: FileText, feature: "receipts" },
  { group: "Operations", to: "/admin/inventory", label: "Inventory", icon: Package, module: "inventory" },
  { group: "Field work", to: "/technical-library", label: "Technical library", icon: FileText, feature: "technical_library" },
  { group: "Team & roster", to: "/team", label: "Team", icon: UserCheck },
  { group: "Team & roster", to: "/admin/jobs", label: "Team dispatch", icon: Send },
  { group: "Team & roster", to: "/skills", label: "Skills & specialties", icon: UserCheck, feature: "skills_dispatch" },
  { group: "Team & roster", to: "/messages", label: "Team chat", icon: MessageSquare },
  { group: "Team & roster", to: "/live-map", label: "Live team map", icon: MapPin },
  { group: "Team & roster", to: "/fleet", label: "Fleet Management", icon: MapPin, feature: "fleet_management" },
  { group: "Team & roster", to: "/team-invites", label: "Invites", icon: Send },
  { group: "Team & roster", to: "/standby", label: "On-call rota", icon: PhoneCall, feature: "standby" },
  { group: "Team & roster", to: "/dwr", label: "Daily works reports", icon: FileText },
  { group: "Team & roster", to: "/admin/leave", label: "Leave approvals", icon: CalendarDays, module: "leave_approvals" },
  { group: "Clients & commercial", to: "/admin/entities", label: "Clients & assets", icon: Users, module: "clients" },
  { group: "Clients & commercial", to: "/qr-codes", label: "QR code generator", icon: QrCode, module: "clients" },
  { group: "Clients & commercial", to: "/contracts", label: "Contracts", icon: FileSignature, module: "contracts", feature: "contracts" },
  { group: "Clients & commercial", to: "/crm", label: "CRM pipeline", icon: Users, module: "clients", feature: "crm_pipeline" },
  { group: "Clients & commercial", to: "/estimates", label: "Estimates & proposals", icon: Calculator, feature: "core" },
  { group: "Clients & commercial", to: "/lift-rfq", label: "Lift supplier RFQs", icon: Calculator, module: "estimates", feature: "lift_pack" },
  { group: "Clients & commercial", to: "/proposals", label: "Advanced proposals", icon: FileText, module: "estimates", feature: "qs_pricing" },
  { group: "Clients & commercial", to: "/surveys", label: "Site surveys", icon: ClipboardList, feature: "site_surveys" },
  { group: "Clients & commercial", to: "/as-built", label: "As-built QS", icon: Calculator, feature: "qs_pricing" },
  { group: "My workspace", to: "/hours", label: "My hours", icon: Clock },
  { group: "My workspace", to: "/leave", label: "My leave", icon: CalendarDays },
  { group: "Administration", to: "/admin/approvals", label: "Approvals", icon: ClipboardList },
  { group: "Administration", to: "/company", label: "Company settings", icon: Building2, module: "team" },
  { group: "Payroll", to: "/payroll/wages", label: "Employee wages setup", icon: Settings, office: true, feature: "payroll" },
  { group: "Payroll", to: "/payroll/hours", label: "Hours worked", icon: Clock, office: true, feature: "payroll" },
  { group: "Payroll", to: "/payroll/payslips", label: "Payslips", icon: Calculator, office: true, feature: "payroll" },
  { group: "Administration", to: "/admin/fields", label: "Fields & lookups", icon: SlidersHorizontal, module: "fields" },
  { group: "My workspace", to: "/settings", label: "My settings", icon: Settings },
  { group: "Administration", to: "/subscription", label: "Billing & Plan", icon: Calculator },
];

/** Supervisors follow the technician menu for their own day, plus a team section. */
const supervisorNav: NavItem[] = [
  { group: "Field work", to: "/dashboard", label: "Today & team", icon: LayoutDashboard },
  { group: "Field work", to: "/sheets", label: "My job sheets", icon: ClipboardList },
  { group: "Field work", to: "/surveys", label: "Site surveys", icon: ClipboardList, feature: "site_surveys" },
  { group: "Field work", to: "/schedule", label: "My schedule", icon: CalendarClock },
  { group: "Field work", to: "/expenses", label: "Log expense", icon: FileText, feature: "receipts" },
  { group: "Field work", to: "/technical-library", label: "Technical library", icon: FileText, feature: "technical_library" },
  { group: "Team", to: "/admin/jobs", label: "Team dispatch", icon: Send },
  { group: "Team", to: "/live-map", label: "Live team map", icon: MapPin },
  { group: "Team", to: "/team", label: "Team", icon: UserCheck },
  { group: "Team", to: "/skills", label: "Skills & specialties", icon: UserCheck, feature: "skills_dispatch" },
  { group: "Team", to: "/available-jobs", label: "Available jobs", icon: Hammer, feature: "skills_dispatch" },
  { group: "Team", to: "/messages", label: "Team chat", icon: MessageSquare },
  { group: "Team", to: "/team-invites", label: "Invites", icon: Send },
  { group: "Team", to: "/fleet", label: "Fleet Management", icon: MapPin, feature: "fleet_management" },
  { group: "Team", to: "/standby", label: "On-call rota", icon: PhoneCall, feature: "standby" },
  { group: "Administration", to: "/admin/approvals", label: "Approvals", icon: ClipboardList },
  { group: "Team", to: "/admin/leave", label: "Leave approvals", icon: CalendarDays, module: "leave_approvals" },
  { group: "Team", to: "/pending-works", label: "Pending works", icon: Hammer, module: "pending_works" },
  { group: "Clients & estimates", to: "/admin/entities", label: "Clients & assets", icon: Users, module: "clients" },
  { group: "Clients & estimates", to: "/qr-codes", label: "QR code generator", icon: QrCode, module: "clients" },
  { group: "Clients & estimates", to: "/crm", label: "CRM pipeline", icon: Users, module: "clients", feature: "crm_pipeline" },
  { group: "Clients & estimates", to: "/estimates", label: "Estimates & proposals", icon: Calculator, feature: "core" },
  { group: "Clients & estimates", to: "/lift-rfq", label: "Lift supplier RFQs", icon: Calculator, module: "estimates", feature: "lift_pack" },
  { group: "Clients & estimates", to: "/proposals", label: "Advanced proposals", icon: FileText, module: "estimates", feature: "qs_pricing" },
  { group: "Clients & estimates", to: "/surveys", label: "Site surveys", icon: ClipboardList, feature: "site_surveys" },
  { group: "Clients & estimates", to: "/as-built", label: "As-built QS", icon: Calculator, feature: "qs_pricing" },
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
  const overview = items.find(i => i.to === "/dashboard");
  const groupedItems = items.filter(i => i.to !== "/dashboard");
  const groups = [...new Set(groupedItems.map((i) => i.group))];
  const activeGroup = groupedItems.find((i) => isActive(path, i.to))?.group ?? groups[0];
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroup);
  useEffect(() => { setOpenGroup(activeGroup); }, [activeGroup]);
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {overview && <Button asChild variant="ghost" className="shrink-0 justify-start text-sidebar-foreground"><Link to="/dashboard" activeProps={{ className: "bg-sidebar-accent font-medium" }} activeOptions={{ exact: true }} onClick={() => { if (uid) recordUsage(uid, "/dashboard"); onNavigate?.(); }}><LayoutDashboard className="mr-2 h-4 w-4" />{overview.label}</Link></Button>}
      {groups.map((g) => {
        const open = openGroup === g;
        return (
          <div key={g}>
            <Button variant="ghost" type="button" aria-expanded={open} onClick={() => setOpenGroup(open ? undefined : g)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <span className="min-w-0 text-left">{g}</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </Button>
            {open && (
              <div className="mb-1 flex flex-col gap-0.5 pl-1">
                {groupedItems.filter((i) => i.group === g).map((i) => i.locked ? <LockedModule key={i.to} feature={i.feature ?? 'core'} label={i.label} comingSoon={i.soon}><i.icon className="h-4 w-4 shrink-0"/></LockedModule> : (
                  <div key={i.to} className="flex items-center gap-1 pr-2"><Link to={i.to}
                    onClick={() => { if (uid) recordUsage(uid, i.to); onNavigate?.(); }}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-medium" }}
                    activeOptions={{ exact: i.to === "/dashboard" }}>
                    <i.icon className="h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{i.label}</span>{i.to === "/standby" && <OnCallBadge userId={uid}/>}{i.to === "/messages" && <ChatBadge userId={uid}/>}
                  </Link>{["/crm","/estimates","/admin/jobs","/admin/leave","/admin/approvals"].includes(i.to) && <QueueBadge path={i.to} />}</div>
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
        {list.map((to) => { const m = meta(to); if (!m) return null; const locked=items.find(i=>i.to===to);if(locked?.locked)return <LockedModule key={to} feature={locked.feature??'core'} label={m.label} comingSoon={locked.soon}><m.icon className="h-5 w-5"/></LockedModule>;return (
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
  const planOn = usePlanFeatures();
  const g = helpFor(path, planOn);
  const [q, setQ] = useState("");
  const results = searchHelp(q, planOn);
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
  const lockVis = useLockedVisibility();
  const navLock = useNavLock(!!actor);
  const office = isOffice(profile);
  const crmLevel = useCrmAccess(!!actor).data ?? "none";
  // Office members with the field-dispatch capability also get their own field screens.
  const extraNav: NavItem[] = manager && profile?.role !== "supervisor" && actor?.can_field_dispatch && !preview.member ? [
    { group: "My workspace", to: "/sheets", label: "My job sheets", icon: ClipboardList },
    { group: "My workspace", to: "/schedule", label: "My schedule", icon: CalendarClock },
  ] : [];
  // Field staff granted CRM access in Company settings get the pipeline too.
  if (!manager && crmAllows(crmLevel, "viewer") && !preview.member) extraNav.push({ group: "Clients", to: "/crm", label: "CRM pipeline", icon: Users, feature: "crm_pipeline" });
  const baseItems = [...(profile?.role === "supervisor" ? supervisorNav : manager ? adminNav : techNav), ...extraNav].filter((i) => (i.to !== "/crm" || crmAllows(crmLevel, "viewer")) && (i.to !== "/subscription" || profile?.role === "superuser") && (i.to !== "/company" || office) && (!i.office || office) && (!i.module || can(i.module) || (i.to === "/company" && office))).map(i => { const feature = i.feature ?? MODULE_ROUTE[i.to] ?? (['/admin/jobs','/pending-works','/admin/inventory','/admin/entities','/qr-codes','/sheets','/schedule','/team','/team-invites','/dwr','/admin/leave','/leave'].includes(i.to) ? 'core' : undefined); const lock = feature ? navLock(feature) : { locked: false, soon: false, hidden: false }; return { ...i, feature, locked: lock.locked, soon: lock.soon, hidden: lock.hidden }; }).filter(i => !i.locked || !i.hidden);
  const lockedFeature = MODULE_ROUTE[path] ?? baseItems.find(i => i.to === path)?.feature;
  const lockedSoon = lockedFeature ? navLock(lockedFeature).soon : false;
  const canSwitch = profile && canViewAsRoles(profile.real_role) && !preview.active;

  const { data: company } = useCompanyRules();
  const appearance = company?.appearance ?? DEFAULT_APPEARANCE;
  const coName = profile?.companies?.name?.trim();
  const personal: Record<string, string> = coName ? { "Team": `${coName} Team`, "Team chat": `${coName} Chat`, "Technical library": `${coName} Technical library` } : {};
  const items = organizeNavigation(profile?.role, baseItems.filter(i => showRoleMenuItem(profile?.role, i.to))).map(i => ({ ...i, label: personal[i.label] ?? industrySheetLabel(appearance.industryPreset, i.label) }));
  const createProps = { manager: manager && !!items.find(i => i.to === "/admin/jobs" && !i.locked), field: (!manager || profile?.role === "supervisor" || !!actor?.can_field_dispatch) && !navLock("core").locked, estimates: manager && !!items.find(i => i.to === "/estimates" && !i.locked), crm: crmAllows(crmLevel, "contributor") && !navLock("crm_pipeline").locked, company: profile?.company_id };
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
  const tab = "flex min-w-0 flex-col items-center gap-1 rounded-md bg-card/95 py-2.5 text-[11px] text-muted-foreground";

  return (
    <div style={appearanceVariables(appearance)} data-icons={appearance.iconPreset} data-company-font={company?.theme.customFontData ? "on" : undefined} className="tenant-experience min-h-screen bg-background lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {actor && !preview.active && <NotificationSounds profile={actor} />}
      {profile && company && <IdleLogout userId={profile.id} realRole={profile.real_role} timeoutMin={company.idleTimeout} />}
      <aside data-tour="menu" className="tenant-menu sticky top-0 hidden h-screen flex-col gap-6 border-r border-sidebar-border bg-sidebar py-6 px-3 lg:flex">
        {brand}
        <NavLinks items={items} uid={profile?.id} />
        {footer}
      </aside>

      <div className="fieldbridge-content flex min-h-screen min-w-0 flex-col">
        <header className="fieldbridge-header sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="bg-card text-card-foreground hover:bg-muted lg:hidden" aria-label="Open menu" data-tour="menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" style={appearanceVariables(appearance)} data-icons={appearance.iconPreset} className="tenant-menu tenant-experience flex w-72 flex-col gap-6 bg-sidebar py-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {brand}
              <NavLinks items={items} uid={profile?.id} onNavigate={() => setMenuOpen(false)} />
              {footer}
            </SheetContent>
          </Sheet>
          <h1 className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] break-words font-display sm:basis-auto sm:truncate text-xl text-foreground sm:text-2xl">{title}</h1>
          <div className="fieldbridge-header-tools flex w-full flex-wrap items-center justify-end gap-2 rounded-md px-2 py-1 sm:ml-auto sm:w-auto">
            {!preview.active && <span data-tour="alerts" className="inline-flex"><ActionNotifications /></span>}
            {profile && !preview.active && <WorkspaceSearch items={items} userId={profile.id} />}
            <HelpButton />
            <PlatformFeedback />
            <AnalyticsTracker />
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
            {!preview.active && <span className="hidden sm:inline-flex"><WorkspaceCreate {...createProps} /></span>}
          </div>
        </header>
        <UserPreviewBanner />
        {actor && !preview.active && <ProfileCompletionGate profile={actor} />}
        <main className="tenant-workspace flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:py-8">
          {actor && !preview.active && <DepartureAlerts userId={actor.id} />}
          {profile && path === "/dashboard" && !preview.active && <QuickActions items={items.filter(i => !i.locked)} uid={profile.id} role={profile.role} manager={manager} />}
          {!preview.active && <LocationSharing />}
          
          {lockedFeature && (!planOn(lockedFeature) || lockedSoon) ? <ModulePreview feature={lockedFeature} title={title} comingSoon={lockedSoon}/> : children}
        </main>
      </div>

      <nav aria-label="Quick navigation" className="fieldbridge-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end gap-1 border-t lg:hidden">
        <Link to="/dashboard" className={tab} activeProps={{ className: "text-primary font-medium" }} activeOptions={{ exact: true }}><LayoutDashboard className="h-5 w-5" />{isOffice(profile) ? "Overview" : "Today & team"}</Link>
        <Link to={manager ? "/admin/jobs" : "/sheets"} className={tab} activeProps={{ className: "text-primary font-medium" }}><ClipboardList className="h-5 w-5" />Job sheets</Link>
        {preview.active ? <Link to="/hours" className={tab}><Clock className="h-5 w-5" />Hours</Link> : <WorkspaceCreate {...createProps} mobile />}
        <Link to={second.to} className={tab} activeProps={{ className: "text-primary font-medium" }}><second.icon className="h-5 w-5" />{second.label}</Link>
        <Button type="button" variant="ghost" className={`${tab} h-auto hover:bg-card`} onClick={() => setMenuOpen(true)}><MoreHorizontal className="h-5 w-5" />More</Button>
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
