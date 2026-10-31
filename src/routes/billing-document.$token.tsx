import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ClientBillingPreview } from '@/components/client-billing-preview';
import { Button } from '@/components/ui/button';
import { buildBillingPdf } from '@/lib/client-billing-pdf';
import type { BillingSnapshot } from '@/lib/client-billing';
export const Route = createFileRoute('/billing-document/$token')({ staticData: { sitemap: false }, head: () => ({ meta: [
  { title: 'Shared billing document — FieldBridge' }, { name: 'description', content: 'Securely view a shared proforma, payment request or invoice and download its PDF.' },
  { property: 'og:title', content: 'Shared billing document — FieldBridge' }, { property: 'og:description', content: 'Secure client billing document.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
] }), component: SharedBilling });
function SharedBilling() {
  const { token } = Route.useParams(); const valid = /^[a-f0-9]{64}$/.test(token); const [error, setError] = useState('');
  const q = useQuery({ queryKey: ['shared-billing', token], enabled: valid, retry: false, queryFn: async () => { const r = await supabase.rpc('read_client_billing', { _token: token }); if (r.error) throw r.error; return r.data as unknown as BillingSnapshot | null; } });
  const download = async () => { if (!q.data) return; try { const bytes = await buildBillingPdf(q.data); const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `${q.data.reference}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); } catch { setError('Could not create PDF'); } };
  return <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">{!valid || !q.isPending && !q.data ? <p role="alert">This document link is unavailable or expired.</p> : q.isPending ? <p>Loading document…</p> : q.data && <><Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Download PDF</Button><ClientBillingPreview snapshot={q.data} /></>}{error && <p role="alert">{error}</p>}</main>;
}