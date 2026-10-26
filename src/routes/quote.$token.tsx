import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CustomerQuotePreview } from '@/components/customer-quote-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download } from 'lucide-react';
import { quoteExpired, type QuoteSnapshot } from '@/lib/customer-quotes';
import { buildCustomerQuotePdf } from '@/lib/customer-quote-pdf';
import { useQuotePhotoUrls } from '@/components/customer-quote-photos';

export const Route = createFileRoute('/quote/$token')({ staticData: { sitemap: false }, head: () => ({ meta: [
  { title: 'Customer quote — FieldBridge' }, { name: 'description', content: 'View a securely shared customer estimate or proposal and download its PDF.' },
  { property: 'og:title', content: 'Customer quote — FieldBridge' }, { property: 'og:description', content: 'Secure customer estimate and proposal review.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
] }), component: QuotePage });
function QuotePage() {
  const { token } = Route.useParams(); const valid = /^[a-f0-9]{64}$/.test(token);
  const q = useQuery({ queryKey: ['shared-customer-quote', token], enabled: valid, retry: false, queryFn: async () => { const r = await supabase.rpc('read_customer_quote', { _token: token }); if (r.error) throw r.error; return r.data as unknown as QuoteSnapshot | null; } });
  const [name, setName] = useState(''); const [comment, setComment] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const photos = useQuotePhotoUrls({ token }, !!q.data?.document.photos?.length);
  const decide = async (decision: 'accepted' | 'declined') => { setBusy(true); setError(''); try { const r = await supabase.rpc('decide_customer_quote', { _token: token, _decision: decision, _name: name, _comment: comment }); if (r.error) throw r.error; await q.refetch(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not record decision'); } finally { setBusy(false); } };
  const download = async () => { if (!q.data) return; setBusy(true); try { const bytes = await buildCustomerQuotePdf(q.data, photos.data ?? {}); const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `${q.data.reference}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); } catch { setError('Could not create PDF'); } finally { setBusy(false); } };
  return <main className="mx-auto max-w-4xl px-4 py-8">{!valid || (!q.isPending && !q.data && !q.error) ? <p role="alert">This quote link is unavailable or has expired.</p> : q.isPending ? <p role="status">Loading quote…</p> : q.error ? <><p role="alert">Could not load this quote.</p><Button onClick={() => q.refetch()}>Retry</Button></> : q.data && <div className="space-y-5"><Button variant="outline" disabled={busy} onClick={download}><Download className="mr-2 h-4 w-4" />Download PDF</Button><CustomerQuotePreview snapshot={q.data} />{q.data.status === 'accepted' || q.data.status === 'declined' ? <p role="status" className="font-medium capitalize">{q.data.status} by {q.data.signer_name}</p> : q.data.allow_decision && !quoteExpired(q.data.document) && <section className="space-y-3">{q.data.status === 'awaiting_confirmation' && <p role="status" className="font-medium">Your acceptance was recorded by phone. Please confirm below so the work can be scheduled.</p>}<Label htmlFor="quote-name">Your full name</Label><Input id="quote-name" maxLength={120} value={name} onChange={e => setName(e.target.value)} /><Label htmlFor="quote-comment">Comment (optional)</Label><Textarea id="quote-comment" maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} /><div className="flex gap-3"><Button disabled={busy || name.trim().length < 2} onClick={() => decide('accepted')}>{q.data.status === 'awaiting_confirmation' ? 'Confirm acceptance' : 'Accept quote'}</Button><Button variant="outline" disabled={busy || name.trim().length < 2} onClick={() => decide('declined')}>Decline</Button></div></section>}{error && <p role="alert" className="text-destructive">{error}</p>}</div>}</main>;
}