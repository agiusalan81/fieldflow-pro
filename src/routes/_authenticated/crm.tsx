import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { AppShell } from '@/components/app-shell';
import { CrmPipeline } from '@/components/crm-pipeline';
import { useProfile, isManager } from '@/lib/profile';
import { useNavLock } from '@/lib/plan-features';
import { ModulePreview } from '@/components/module-preview';
export const Route = createFileRoute('/_authenticated/crm')({ staticData: { sitemap: false }, validateSearch: z.object({ lead: z.string().uuid().optional() }), head: () => ({ meta: [
  { title: 'CRM pipeline — FieldBridge' }, { name: 'description', content: 'Track phone and email enquiries, follow-ups and won work in one pipeline.' },
  { property: 'og:title', content: 'CRM pipeline — FieldBridge' }, { property: 'og:description', content: 'Lead pipeline with follow-up reminders and one-click conversion to estimates and jobs.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: CrmPage });
function CrmPage() {
  const { data: profile } = useProfile(); const lock = useNavLock(); const { lead } = Route.useSearch(); const navigate = useNavigate();
  return <AppShell title="CRM pipeline">{!profile ? <p>Loading…</p> : !isManager(profile) ? <p>Office or supervisor access required.</p> : lock('crm_pipeline').locked ? <ModulePreview feature="crm_pipeline" comingSoon={lock('crm_pipeline').soon} /> : <CrmPipeline leadId={lead} onOpenLead={(id) => void navigate({ to: '/crm', search: id ? { lead: id } : {} })} />}</AppShell>;
}
