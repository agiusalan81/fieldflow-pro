import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { CustomerQuotes } from '@/components/customer-quotes';
import { SupplierRfqs } from '@/components/supplier-rfqs';
import { useProfile, isManager } from '@/lib/profile';
import { useNavLock } from '@/lib/plan-features';
import { ModulePreview } from '@/components/module-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
export const Route = createFileRoute('/_authenticated/estimates')({ staticData: { sitemap: false }, validateSearch: z.object({ fromSheet: z.string().uuid().optional() }), head: () => ({ meta: [
  { title: 'Customer estimates & proposals — FieldBridge' }, { name: 'description', content: 'Create customer estimates and simple proposals, review prices, share branded documents and convert accepted quotes into jobs.' },
  { property: 'og:title', content: 'Customer estimates & proposals — FieldBridge' }, { property: 'og:description', content: 'Customer quotes, approval history and linked scheduled work.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: EstimatesPage });
function EstimatesPage() {
  const { data: profile } = useProfile(); const lock = useNavLock(); const [tab, setTab] = useState('customers'); const { fromSheet } = Route.useSearch(); const navigate = useNavigate();
  return <AppShell title="Estimates & proposals">{!profile ? <p>Loading…</p> : !isManager(profile) ? <p>Office or supervisor access required.</p> : <div className="mx-auto max-w-6xl"><Tabs value={tab} onValueChange={setTab}><TabsList className="mb-5"><TabsTrigger value="customers">Customer estimates</TabsTrigger><TabsTrigger value="suppliers">Supplier RFQs</TabsTrigger></TabsList><TabsContent value="customers"><CustomerQuotes {...(fromSheet ? { fromSheet } : {})} clearSource={() => { void navigate({ to: '/estimates', search: {}, replace: true }); }} /></TabsContent><TabsContent value="suppliers">{tab === 'suppliers' && (lock('estimates').locked ? <ModulePreview feature="estimates" comingSoon={lock('estimates').soon} /> : lock('lift_pack').locked ? <ModulePreview feature="lift_pack" comingSoon={lock('lift_pack').soon} /> : <SupplierRfqs />)}</TabsContent></Tabs></div>}</AppShell>;
}