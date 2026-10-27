import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { AppShell } from '@/components/app-shell';
import { CustomerQuotes } from '@/components/customer-quotes';
import { useMemberWorkspaces } from '@/lib/member-workspaces';
import { useProfile } from '@/lib/profile';
export const Route = createFileRoute('/_authenticated/estimates')({ staticData: { sitemap: false }, validateSearch: z.object({ fromSheet: z.string().uuid().optional(), quote: z.string().uuid().optional(), new: z.coerce.boolean().optional() }), head: () => ({ meta: [
  { title: 'Customer estimates & proposals — FieldBridge' }, { name: 'description', content: 'Create customer estimates and simple proposals, review prices, share branded documents and convert accepted quotes into jobs.' },
  { property: 'og:title', content: 'Customer estimates & proposals — FieldBridge' }, { property: 'og:description', content: 'Customer quotes, approval history and linked scheduled work.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: EstimatesPage });
function EstimatesPage() {
  const { data: profile } = useProfile(); const access = useMemberWorkspaces(); const { fromSheet, quote, new: createNew } = Route.useSearch(); const navigate = useNavigate();
  return <AppShell title="Estimates, quotes & proposals">{!profile || access.isPending ? <p>Loading…</p> : !access.data?.estimates ? <p>Estimates & quotes capability required.</p> : <div className="mx-auto max-w-6xl"><CustomerQuotes createNew={createNew} {...(fromSheet ? { fromSheet } : {})} {...(quote ? { focusQuote: quote } : {})} clearSource={() => { void navigate({ to: '/estimates', search: {}, replace: true }); }} /></div>}</AppShell>;
}
