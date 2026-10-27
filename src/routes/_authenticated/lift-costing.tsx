import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { LiftCosting } from '@/components/lift-costing';
import { useProfile, isManager } from '@/lib/profile';
import { useNavLock } from '@/lib/plan-features';
import { ModulePreview } from '@/components/module-preview';
export const Route = createFileRoute('/_authenticated/lift-costing')({ staticData: { sitemap: false }, head: () => ({ meta: [
  { title: 'Lift costing sheets — FieldBridge' }, { name: 'description', content: 'Lifts & Escalators pack: internal project costing, margin comparison and customer quote generation.' },
  { property: 'og:title', content: 'Lift costing sheets — FieldBridge' }, { property: 'og:description', content: 'Private company costing sheets; supplier costs and margins never reach client documents.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: LiftCostingPage });
function LiftCostingPage() {
  const { data: profile } = useProfile(); const lock = useNavLock();
  return <AppShell title="Lift costing sheets">{!profile ? <p>Loading…</p> : !isManager(profile) ? <p>Office or supervisor access required.</p> : <div className="mx-auto max-w-6xl">{lock('lift_pack').locked ? <ModulePreview feature="lift_pack" comingSoon={lock('lift_pack').soon} /> : <LiftCosting />}</div>}</AppShell>;
}
