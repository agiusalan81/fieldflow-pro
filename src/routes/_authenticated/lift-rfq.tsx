import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { SupplierRfqs } from '@/components/supplier-rfqs';
import { useProfile, isManager } from '@/lib/profile';
import { useNavLock } from '@/lib/plan-features';
import { ModulePreview } from '@/components/module-preview';
export const Route = createFileRoute('/_authenticated/lift-rfq')({ staticData: { sitemap: false }, head: () => ({ meta: [
  { title: 'Lift supplier RFQs — FieldBridge' }, { name: 'description', content: 'Lifts & Escalators pack: request and track internal supplier quotations for lift components.' },
  { property: 'og:title', content: 'Lift supplier RFQs — FieldBridge' }, { property: 'og:description', content: 'Internal lift component supplier quotations, kept separate from customer documents.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: LiftRfqPage });
function LiftRfqPage() {
  const { data: profile } = useProfile(); const lock = useNavLock();
  return <AppShell title="Lift supplier RFQs">{!profile ? <p>Loading…</p> : !isManager(profile) ? <p>Office or supervisor access required.</p> : <div className="mx-auto max-w-6xl">{lock('lift_pack').locked ? <ModulePreview feature="lift_pack" comingSoon={lock('lift_pack').soon} /> : lock('estimates').locked ? <ModulePreview feature="estimates" comingSoon={lock('estimates').soon} /> : <SupplierRfqs />}</div>}</AppShell>;
}
