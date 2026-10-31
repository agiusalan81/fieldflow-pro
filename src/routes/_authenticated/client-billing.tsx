import { createFileRoute } from '@tanstack/react-router';
import { AppShell, EmptyState } from '@/components/app-shell';
import { ClientBilling } from '@/components/client-billing';
import { useProfile, isOffice } from '@/lib/profile';
import { useEdition, usePlanFeatures } from '@/lib/plan-features';

export const Route = createFileRoute('/_authenticated/client-billing')({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>) => ({ document: typeof s['document'] === 'string' ? s['document'] : undefined }),
  head: () => ({ meta: [
    { title: 'Client billing — FieldBridge' }, { name: 'description', content: 'Prepare proformas, payment requests and invoices, and track client payments.' },
    { property: 'og:title', content: 'Client billing — FieldBridge' }, { property: 'og:description', content: 'Contractor billing with explicit invoice issuance and payment tracking.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: BillingPage,
});
function BillingPage() {
  const { data: profile } = useProfile(); const { edition } = useEdition(); const on = usePlanFeatures(); const { document } = Route.useSearch();
  return <AppShell title="Client billing">{!profile ? <p>Loading…</p> : edition !== 'contractor' || !isOffice(profile) || !on('core') ? <EmptyState>Client billing is available to FieldBridge contractor office members with Core access.</EmptyState> : <ClientBilling documentId={document} />}</AppShell>;
}