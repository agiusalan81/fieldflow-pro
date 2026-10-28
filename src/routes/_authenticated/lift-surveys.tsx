import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { LiftSurveys } from '@/components/lift-surveys';
import { useProfile, isManager } from '@/lib/profile';
import { useNavLock } from '@/lib/plan-features';
import { ModulePreview } from '@/components/module-preview';
export const Route = createFileRoute('/_authenticated/lift-surveys')({ staticData: { sitemap: false }, validateSearch: (s: Record<string, unknown>) => ({ new: s['new'] === '1' || s['new'] === 1 ? '1' as const : undefined }), head: () => ({ meta: [
  { title: 'Lift site surveys — FieldBridge' }, { name: 'description', content: 'Lifts & Escalators pack: on-site shaft measures and surveys that feed supplier RFQs.' },
  { property: 'og:title', content: 'Lift site surveys — FieldBridge' }, { property: 'og:description', content: 'Private company site measure and shaft survey records.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: LiftSurveysPage });
function LiftSurveysPage() {
  const { data: profile } = useProfile(); const lock = useNavLock(); const { new: autoNew } = Route.useSearch();
  return <AppShell title="Lift site surveys">{!profile ? <p>Loading…</p> : !isManager(profile) ? <p>Office or supervisor access required.</p> : <div className="mx-auto max-w-6xl">{lock('lift_pack').locked ? <ModulePreview feature="lift_pack" comingSoon={lock('lift_pack').soon} /> : <LiftSurveys autoNew={autoNew === '1'} />}</div>}</AppShell>;
}
