import { Link } from '@tanstack/react-router';
import { LockKeyhole } from 'lucide-react';
import { MODULE_DESCRIPTIONS, PLAN_FEATURES } from '@/lib/plan-features';
import { useProfile } from '@/lib/profile';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ReactNode } from 'react';
export const MODULE_ROUTE: Record<string, string> = { '/fleet':'fleet_management', '/live-map':'tracking', '/standby':'standby', '/technical-library':'technical_library', '/expenses':'receipts', '/estimates':'estimates', '/contracts':'contracts', '/proposals':'qs_pricing', '/as-built':'qs_pricing', '/skills':'skills_dispatch', '/available-jobs':'skills_dispatch', '/payroll':'payroll', '/payroll/wages':'payroll', '/payroll/hours':'payroll', '/payroll/payslips':'payroll' };
export function ModulePreview({ feature, title }: { feature: string; title?: string }) {
  const { data: profile } = useProfile();
  return <section className="space-y-4 py-5"><LockKeyhole className="h-7 w-7 text-muted-foreground"/><h2 className="text-xl font-semibold">{title ?? PLAN_FEATURES.find(f => f.key === feature)?.label ?? feature}</h2><p className="text-sm text-muted-foreground">{MODULE_DESCRIPTIONS[feature] ?? 'This module is available with an eligible plan or service pack.'}</p>{profile?.real_role === 'superuser' ? <Button asChild><Link to="/subscription">View plans & service packs</Link></Button> : <p className="text-sm text-muted-foreground">Ask your Company Superuser to enable this module.</p>}</section>;
}
export function LockedModule({ feature, label, children }: { feature: string; label: string; children: ReactNode }) {
  return <Popover><PopoverTrigger asChild><Button variant="ghost" className="h-auto w-full justify-start gap-3 px-3 py-2 text-left text-sm text-muted-foreground" aria-label={`${label} — locked`} onMouseEnter={e => { if (e.currentTarget.getAttribute('data-state') === 'closed') e.currentTarget.click(); }}>{children}<span className="min-w-0 flex-1 break-words">{label}</span><LockKeyhole className="h-3.5 w-3.5 shrink-0"/></Button></PopoverTrigger><PopoverContent side="right" className="max-w-[calc(100vw-2rem)]"><ModulePreview feature={feature} title={label}/></PopoverContent></Popover>;
}