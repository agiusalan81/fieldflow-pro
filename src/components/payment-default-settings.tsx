import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { BANK_FIELDS, paymentDefaults } from '@/lib/payment-defaults';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
export function PaymentDefaultSettings({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['client-billing-settings'], queryFn: async () => { const r = await supabase.from('client_billing_settings').select('*').maybeSingle(); if (r.error) throw r.error; return r.data; } });
  const [draft, setDraft] = useState<ReturnType<typeof paymentDefaults> | null>(null); const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (q.data !== undefined && !dirty) setDraft(paymentDefaults(q.data?.defaults)); }, [q.data, dirty]);
  if (!draft) return q.error ? <p role="alert" className="text-destructive">Payment defaults unavailable.</p> : null;
  const save = async () => { setBusy(true); try { const latest = await supabase.from('client_billing_settings').select('defaults').maybeSingle(); if (latest.error) throw latest.error; const r = await supabase.from('client_billing_settings').upsert({ company_id: companyId, defaults: { ...(latest.data?.defaults as object ?? {}), ...draft } }); if (r.error) throw r.error; setDirty(false); await qc.invalidateQueries({ queryKey: ['client-billing-settings'] }); await qc.invalidateQueries({ queryKey: ['branding-financial-defaults'] }); toast.success('Shared payment defaults saved'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save payment defaults'); } finally { setBusy(false); } };
  return <section className="space-y-4 border-t pt-5"><h3 className="font-semibold">Bank & payment methods</h3><div className="grid gap-4 sm:grid-cols-2">{BANK_FIELDS.map(([key, label]) => <div key={key}><Label htmlFor={`bank-${key}`}>{label}</Label><Input id={`bank-${key}`} maxLength={200} value={draft.bank[key]} onChange={e => setDraft({ ...draft, bank: { ...draft.bank, [key]: e.target.value } })} /></div>)}<div><Label htmlFor="shared-payment-methods">Accepted payment methods & instructions</Label><Textarea id="shared-payment-methods" value={draft.payment_methods} onChange={e => setDraft({ ...draft, payment_methods: e.target.value })} /></div><div><Label htmlFor="shared-payment-terms">Default payment terms</Label><Textarea id="shared-payment-terms" value={draft.payment_terms} onChange={e => setDraft({ ...draft, payment_terms: e.target.value })} /></div></div><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save bank & payment defaults'}</Button></section>;
}