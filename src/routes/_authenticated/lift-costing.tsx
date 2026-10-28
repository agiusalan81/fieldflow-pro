import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AppShell } from '@/components/app-shell';
import { LiftCosting } from '@/components/lift-costing';
import { useProfile, isManager } from '@/lib/profile';
import { useNavLock } from '@/lib/plan-features';
import { ModulePreview } from '@/components/module-preview';
import { useMemberWorkspaces } from '@/lib/member-workspaces';
export const Route = createFileRoute('/_authenticated/lift-costing')({ staticData: { sitemap: false }, validateSearch: z.object({ sheet: z.string().uuid().optional() }), head: () => ({ meta: [
  { title: 'Lift costing sheets — FieldBridge' }, { name: 'description', content: 'Lifts & Escalators pack: internal project costing, margin comparison and customer quote generation.' },
  { property: 'og:title', content: 'Lift costing sheets — FieldBridge' }, { property: 'og:description', content: 'Private company costing sheets; supplier costs and margins never reach client documents.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: LiftCostingPage });
function LiftCostingPage() {
  const { data: profile } = useProfile(); const lock = useNavLock(); const { sheet } = Route.useSearch(); const ws = useMemberWorkspaces();
  return <AppShell title="Lift costing sheets">{!profile ? <p>Loading…</p> : !isManager(profile) || (ws.data && !ws.data.lift_costing) ? <p>Lift costing sheets are not enabled for your account. Ask your office admin to switch on “Lift costing sheets” for you in Skills & specialties.</p> : <div className="mx-auto max-w-6xl">{lock('lift_pack').locked ? <ModulePreview feature="lift_pack" comingSoon={lock('lift_pack').soon} /> : <LiftCosting openSheet={sheet} />}</div>}</AppShell>;
}
