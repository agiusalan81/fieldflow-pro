import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, ClipboardList, Clock, MessageSquare, CalendarDays, Users, Wrench, SlidersHorizontal, Package, LogOut, Menu, Plus, CalendarClock, Settings, Building2, FileSignature, Hammer, Calculator,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isManager, isOffice, setViewAs, ROLE_LABEL, type ViewAs } from "@/lib/profile";
import { useCan, type ModuleKey } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";

type NavItem = { to: string; label: string; icon: typeof Clock; module?: ModuleKey; office?: boolean };

const techNav: NavItem[] = [
  { to: "/dashboard", label: "Today", icon: LayoutDashboard },
  { to: "/sheets", label: "Sheets", icon: ClipboardList },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
  { to: "/leave", label: "Leave", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/messages", label: "Chat", icon: MessageSquare },
  { to: "/overtime", label: "Overtime", icon: Clock },
];

const adminNav: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/jobs", label: "Job sheets", icon: ClipboardList },
  { to: "/pending-works", label: "Pending works", icon: Hammer, module: "pending_works" },
  { to: "/admin/entities", label: "Clients & assets", icon: Users, module: "clients" },
  { to: "/contracts", label: "Contracts", icon: FileSignature, module: "contracts" },
  { to: "/estimates", label: "Lift estimates", icon: Calculator, module: "estimates" },
  { to: "/admin/inventory", label: "Inventory", icon: Package, module: "inventory" },
  { to: "/leave", label: "Leave", icon: CalendarDays },
  { to: "/messages", label: "Chat", icon: MessageSquare },
  { to: "/admin/fields", label: "Fields & lookups", icon: SlidersHorizontal, module: "fields" },
  { to: "/company", label: "Company", icon: Building2, module: "team" },
  { to: "/sheets", label: "My job sheets", icon: Wrench },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-medium" }}
          activeOptions={{ exact: i.to === "/dashboard" }}
        >
          <i.icon className="h-4 w-4 shrink-0" />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const manager = isManager(profile);
  const can = useCan(profile);
  const office = isOffice(profile);
  const items = (manager ? adminNav : techNav).filter((i) => !i.module || can(i.module) || (i.to === "/company" && office));
  const canSwitch = profile && profile.real_role !== "technician";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", profile?.app_theme_preference === "dark");
  }, [profile?.app_theme_preference]);

  const signOut = async () => {
    setViewAs(null);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const brand = (
    <div className="px-3">
      <p className="font-display text-xl text-sidebar-foreground">FieldOps</p>
      <p className="truncate text-xs text-sidebar-foreground/60">{profile?.companies?.name ?? "—"}</p>
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

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-sidebar-border bg-sidebar py-6 px-3 lg:flex">
        {brand}
        <NavLinks items={items} />
        {footer}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col gap-6 bg-sidebar py-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {brand}
              <NavLinks items={items} />
              {footer}
            </SheetContent>
          </Sheet>
          <h1 className="truncate font-display text-xl text-foreground sm:text-2xl">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">
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
            {actions}
            <Button asChild size="sm" variant={actions ? "outline" : "default"}>
              <Link to="/sheets/new" search={{}}><Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Create New Job Sheet</span></Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card lg:hidden">
        {items.slice(0, 5).map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-medium" }}
            activeOptions={{ exact: i.to === "/dashboard" }}
          >
            <i.icon className="h-5 w-5" />
            <span className="truncate">{i.label}</span>
          </Link>
        ))}
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
