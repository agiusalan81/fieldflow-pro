import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { LockedModule } from '@/components/module-preview';
import { ChatBadge, OnCallBadge, QueueBadge } from '@/components/action-notifications';
import { workspaceShortcuts, type WorkspaceShortcut } from '@/lib/workspace-shortcuts';
import { recordUsage } from '@/lib/quick-actions';

export type WorkspaceNavItem = { to: string; label: string; group: string; icon: LucideIcon; search?: Record<string, string>; feature?: string; locked?: boolean; soon?: boolean };

function WorkspaceRow({ item, role, touch, uid, onNavigate, keepOpen, close }: { item: WorkspaceNavItem; role?: string; touch: boolean; uid?: string; onNavigate?: () => void; keepOpen: () => void; close: () => void }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const shortcuts = workspaceShortcuts(item.to, role, item.search?.view);
  const enter = () => { clearTimeout(timer.current); keepOpen(); if (!touch) setOpen(true); };
  const leave = () => { if (!touch) timer.current = setTimeout(() => { setOpen(false); close(); }, 140); };
  const go = (target: WorkspaceShortcut) => { if (uid) recordUsage(uid, target.to); setOpen(false); onNavigate?.(); };
  const links = <nav aria-label={`${item.label} shortcuts`} className="flex flex-col gap-1">{shortcuts.map(s => <Button key={s.label} asChild variant="ghost" className="h-auto min-h-9 justify-start whitespace-normal text-left"><Link to={s.to} search={s.search ?? {}} onClick={() => go(s)}>{s.label}</Link></Button>)}</nav>;
  if (item.locked) return <LockedModule feature={item.feature ?? 'core'} label={item.label} comingSoon={item.soon}><item.icon className="h-4 w-4 shrink-0" /></LockedModule>;
  const row = <div className="flex items-center gap-1" onMouseEnter={enter} onMouseLeave={leave}>
    <Button asChild variant="ghost" className="h-auto min-h-10 min-w-0 flex-1 justify-start gap-2 whitespace-normal px-2 text-left text-sidebar-foreground/80"><Link to={item.to} search={item.search ?? {}} activeProps={{ className: 'bg-sidebar-accent font-medium text-sidebar-foreground' }} onClick={() => go(item)}><item.icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{item.label}</span>{item.to === '/standby' && <OnCallBadge userId={uid} />}{item.to === '/messages' && <ChatBadge userId={uid} />}</Link></Button>
    {['/crm', '/estimates', '/admin/jobs', '/admin/leave', '/admin/approvals'].includes(item.to) && <QueueBadge path={item.to} />}
    {shortcuts.length > 0 && <Button size="icon" variant="ghost" className="h-8 w-7 shrink-0 text-sidebar-foreground" aria-label={`${item.label} shortcuts`} aria-expanded={open} onClick={() => setOpen(v => !v)}><ChevronRight className={`h-4 w-4 ${touch && open ? 'rotate-90' : ''}`} /></Button>}
  </div>;
  if (touch || !shortcuts.length) return <div>{row}{touch && open && <div className="mb-2 ml-5 border-l border-sidebar-border pl-2">{links}</div>}</div>;
  return <Popover open={open} onOpenChange={setOpen}><PopoverAnchor asChild>{row}</PopoverAnchor><PopoverContent side="right" align="start" sideOffset={0} className="w-64 p-2" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onMouseEnter={enter} onMouseLeave={leave}><p className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">{item.label}</p>{links}</PopoverContent></Popover>;
}

export function WorkspaceNavigation({ items, role, uid, onNavigate, touch = false }: { items: WorkspaceNavItem[]; role?: string; uid?: string; onNavigate?: () => void; touch?: boolean }) {
  const [openGroup, setOpenGroup] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const overview = items.find(i => i.to === '/dashboard');
  const groups = [...new Set(items.filter(i => i !== overview).map(i => i.group))].sort((a, b) => a === 'My workspace' ? 1 : b === 'My workspace' ? -1 : 0);
  const keepOpen = () => clearTimeout(timer.current);
  const close = () => { if (!touch) timer.current = setTimeout(() => setOpenGroup(undefined), 180); };
  return <nav aria-label="Workspace menu" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
    {overview && <Button asChild variant="ghost" className="justify-start text-sidebar-foreground"><Link to="/dashboard" onClick={onNavigate}><LayoutDashboard className="mr-2 h-4 w-4" />{overview.label}</Link></Button>}
    {groups.map(group => <div key={group} onMouseEnter={() => { if (!touch) { keepOpen(); setOpenGroup(group); } }} onMouseLeave={close} onBlur={e => { if (!touch && !e.currentTarget.contains(e.relatedTarget)) close(); }}>
      <Button variant="ghost" className="h-auto min-h-11 w-full justify-between whitespace-normal text-left text-xs font-semibold text-sidebar-foreground" aria-expanded={openGroup === group} onClick={() => setOpenGroup(openGroup === group ? undefined : group)} onFocus={() => { if (!touch) { keepOpen(); setOpenGroup(group); } }}><span>{group}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openGroup === group ? '' : '-rotate-90'}`} /></Button>
      {openGroup === group && <div className="mb-2 border-l border-sidebar-border pl-2">{items.filter(i => i.group === group).map(i => <WorkspaceRow key={i.to + JSON.stringify(i.search ?? {})} item={i} role={role} uid={uid} touch={touch} keepOpen={keepOpen} close={close} onNavigate={() => { setOpenGroup(undefined); onNavigate?.(); }} />)}</div>}
    </div>)}
  </nav>;
}