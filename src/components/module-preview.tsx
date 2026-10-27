import { Link } from '@tanstack/react-router';
import { LockKeyhole } from 'lucide-react';
import { MODULE_DESCRIPTIONS, PLAN_FEATURES } from '@/lib/plan-features';
import { useProfile } from '@/lib/profile';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
export const MODULE_ROUTE: Record<string, string> = { '/fleet':'fleet_management', '/live-map':'tracking', '/standby':'standby', '/technical-library':'technical_library', '/expenses':'receipts', '/estimates':'core', '/surveys':'site_surveys', '/contracts':'contracts', '/lift-rfq':'lift_pack', '/crm':'crm_pipeline', '/proposals':'qs_pricing', '/as-built':'qs_pricing', '/skills':'skills_dispatch', '/available-jobs':'skills_dispatch', '/payroll':'payroll', '/payroll/wages':'payroll', '/payroll/hours':'payroll', '/payroll/payslips':'payroll' };
export function ModulePreview({ feature, title, comingSoon }: { feature: string; title?: string | undefined; comingSoon?: boolean | undefined }) {
  const { data: profile } = useProfile();
  if (comingSoon) return <ComingSoon feature={feature} title={title}/>;
  return <section className="space-y-4 py-5"><LockKeyhole className="h-7 w-7 text-muted-foreground"/><h2 className="text-xl font-semibold">{title ?? PLAN_FEATURES.find(f => f.key === feature)?.label ?? feature}</h2><p className="text-sm text-muted-foreground">{MODULE_DESCRIPTIONS[feature] ?? 'This module is available with an eligible plan or service pack.'}</p>{profile?.real_role === 'superuser' ? <Button asChild><Link to="/subscription">View plans & service packs</Link></Button> : <p className="text-sm text-muted-foreground">Ask your Company Superuser to enable this module.</p>}</section>;
}
export function LockedModule({ feature, label, children, comingSoon }: { feature: string; label: string; children: ReactNode; comingSoon?: boolean | undefined }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" className="h-auto w-full justify-start gap-3 px-3 py-2 text-left text-sm text-muted-foreground" aria-label={`${label} — locked`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>{children}<span className="flex min-w-0 flex-1 flex-col pr-1"><span className="whitespace-normal break-words">{label}</span>{comingSoon && <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Coming soon</span>}</span>{!comingSoon && <LockKeyhole className="h-3.5 w-3.5 shrink-0"/>}</Button></PopoverTrigger><PopoverContent side="right" className="max-w-[calc(100vw-2rem)]" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}><ModulePreview feature={feature} title={label} comingSoon={comingSoon}/></PopoverContent></Popover>;
}
function ComingSoon({ feature, title }: { feature: string; title?: string | undefined }) {
  const name = title ?? PLAN_FEATURES.find(f => f.key === feature)?.label ?? feature;
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const inquire = async () => {
    setBusy(true);
    try {
      const r = await supabase.from('platform_custom_requests').insert({ title: `Coming soon inquiry: ${name}`.slice(0, 160), category: 'custom_module', notes: `We are interested in ${name} (${feature}) when it becomes available.`, target_date: null }).select('id').single();
      if (r.error) throw r.error;
      const u = await supabase.from('platform_custom_requests').update({ status: 'submitted' }).eq('id', r.data.id);
      if (u.error) throw u.error;
      setSent(true); toast.success('Inquiry sent — we will let you know when it is available');
    } catch (e) { toast.error((e as { message?: string })?.message ?? 'Inquiry could not be sent'); } finally { setBusy(false); }
  };
  return <section className="space-y-4 py-5"><span className="inline-block rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide">Coming soon</span><h2 className="text-xl font-semibold">{name}</h2><p className="text-sm text-muted-foreground">{MODULE_DESCRIPTIONS[feature] ?? 'This module is being prepared.'}</p><Button disabled={busy || sent} onClick={inquire}>{sent ? 'Inquiry sent' : busy ? 'Sending…' : 'Inquire'}</Button></section>;
}
