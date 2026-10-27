import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LockedModule } from '@/components/module-preview';
import { ChatBadge, OnCallBadge, QueueBadge } from '@/components/action-notifications';
import { workspaceShortcuts, type WorkspaceShortcut } from '@/lib/workspace-shortcuts';
import { recordUsage } from '@/lib/quick-actions';

export type WorkspaceNavItem = { to: string; label: string; group: string; icon: LucideIcon; search?: Record<string, string>; feature?: string | undefined; locked?: boolean; soon?: boolean };

/** Inline accordion: menus open and close only on click/tap, never on hover. */
function WorkspaceRow({ item, role, uid, onNavigate }: { item: WorkspaceNavItem; role?: string | undefined; uid?: string | undefined; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const shortcuts = workspaceShortcuts(item.to, role, item.search?.['view']);
  const go = (target: WorkspaceShortcut) => { if (uid) recordUsage(uid, target.to); onNavigate?.(); };
  if (item.locked) return <LockedModule feature={item.feature ?? 'core'} label={item.label} comingSoon={item.soon}><item.icon className="h-4 w-4 shrink-0" /></LockedModule>;
  return <div>
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" className="h-auto min-h-10 min-w-0 flex-1 justify-start gap-2 whitespace-normal px-2 text-left text-sidebar-foreground/80"><Link to={item.to} search={item.search ?? {}} activeProps={{ className: 'bg-sidebar-accent font-medium text-sidebar-foreground' }} onClick={() => go(item)}><item.icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{item.label}</span>{item.to === '/standby' && <OnCallBadge userId={uid} />}{item.to === '/messages' && <ChatBadge userId={uid} />}</Link></Button>
      {['/crm', '/estimates', '/admin/jobs', '/admin/leave', '/admin/approvals'].includes(item.to) && <QueueBadge path={item.to} />}
      {shortcuts.length > 0 && <Button size="icon" variant="ghost" className="h-8 w-7 shrink-0 text-sidebar-foreground" aria-label={`${item.label} shortcuts`} aria-expanded={open} onClick={() => setOpen(v => !v)}><ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} /></Button>}
    </div>
    {open && shortcuts.length > 0 && <nav aria-label={`${item.label} shortcuts`} className="mb-2 ml-5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">{shortcuts.map(s => <Button key={s.label} asChild variant="ghost" className="h-auto min-h-9 justify-start whitespace-normal text-left text-sm text-sidebar-foreground/80"><Link to={s.to} search={s.search ?? {}} onClick={() => go(s)}>{s.label}</Link></Button>)}</nav>}
  </div>;
}

export function WorkspaceNavigation({ items, role, uid, onNavigate }: { items: WorkspaceNavItem[]; role?: string | undefined; uid?: string | undefined; onNavigate?: () => void; touch?: boolean }) {
  const [openGroup, setOpenGroup] = useState<string>();
  const overview = items.find(i => i.to === '/dashboard');
  const order = ['My field work', 'Operations & field', 'Team supervision', 'Commercial & CRM', 'Team & workforce', 'Payroll & Leave', 'Fleet & expenses', 'Vertical packs', 'Company administration', 'My time & rota', 'My workspace'];
  const groups = [...new Set(items.filter(i => i !== overview).map(i => i.group))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return <nav aria-label="Workspace menu" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
    {overview && <Button asChild variant="ghost" className="justify-start text-sidebar-foreground"><Link to="/dashboard" onClick={onNavigate}><LayoutDashboard className="mr-2 h-4 w-4" />{overview.label}</Link></Button>}
    {groups.map(group => <div key={group}>
      <Button variant="ghost" className="h-auto min-h-11 w-full justify-between whitespace-normal text-left text-xs font-semibold text-sidebar-foreground" aria-expanded={openGroup === group} onClick={() => setOpenGroup(openGroup === group ? undefined : group)}><span>{group}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openGroup === group ? '' : '-rotate-90'}`} /></Button>
      {openGroup === group && <div className="mb-2 border-l border-sidebar-border pl-2">{items.filter(i => i.group === group).map(i => <WorkspaceRow key={i.to + JSON.stringify(i.search ?? {})} item={i} role={role} uid={uid} onNavigate={onNavigate} />)}</div>}
    </div>)}
  </nav>;
}
