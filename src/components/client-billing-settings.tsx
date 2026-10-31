import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { BILLING_KINDS, type BillingKind } from '@/lib/client-billing';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ClientBillingSettings({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['client-billing-settings'], queryFn: async () => { const r = await supabase.from('client_billing_settings').select('*').maybeSingle(); if (r.error) throw r.error; return r.data; } });
  const [enabled, setEnabled] = useState<Record<BillingKind, boolean>>({ proforma: false, payment_request: false, invoice: false });
  const [formats, setFormats] = useState<Record<BillingKind, { prefix: string; padding: number }>>({ proforma: { prefix: 'PRO-', padding: 5 }, payment_request: { prefix: 'PAY-', padding: 5 }, invoice: { prefix: 'INV-', padding: 5 } });
  const [defaults, setDefaults] = useState({ payment_terms: '', payment_methods: '', terms: '', notes: '' }); const [busy, setBusy] = useState(false);
  useEffect(() => { if (query.data) { setEnabled({ proforma: query.data.proforma_enabled, payment_request: query.data.payment_request_enabled, invoice: query.data.invoice_enabled }); setFormats(query.data.formats as unknown as typeof formats); setDefaults({ payment_terms: '', payment_methods: '', terms: '', notes: '', ...(query.data.defaults as object) }); } }, [query.data]);
  const save = async () => { setBusy(true); const r = await supabase.from('client_billing_settings').upsert({ company_id: companyId, proforma_enabled: enabled.proforma, payment_request_enabled: enabled.payment_request, invoice_enabled: enabled.invoice, formats: formats as unknown as Json, defaults }); setBusy(false); if (r.error) toast.error(r.error.message); else { toast.success('Client billing settings saved'); void qc.invalidateQueries({ queryKey: ['client-billing-settings'] }); } };
  return <section className="max-w-4xl space-y-5"><h2 className="font-semibold">Client billing</h2>{query.error && <p role="alert" className="text-destructive">Billing settings unavailable.</p>}
    {(Object.keys(BILLING_KINDS) as BillingKind[]).map(kind => <div key={kind} className="grid items-end gap-3 border-b pb-4 sm:grid-cols-[1fr_10rem_6rem]"><label className="flex items-center gap-3 py-2"><Switch checked={enabled[kind]} onCheckedChange={on => setEnabled({ ...enabled, [kind]: on })} aria-label={`Enable ${BILLING_KINDS[kind]}`} />{BILLING_KINDS[kind]}</label><div><Label htmlFor={`prefix-${kind}`}>Number prefix</Label><Input id={`prefix-${kind}`} maxLength={30} value={formats[kind].prefix} onChange={e => setFormats({ ...formats, [kind]: { ...formats[kind], prefix: e.target.value } })} /></div><div><Label htmlFor={`digits-${kind}`}>Digits</Label><Input id={`digits-${kind}`} type="number" min={1} max={12} value={formats[kind].padding} onChange={e => setFormats({ ...formats, [kind]: { ...formats[kind], padding: Number(e.target.value) } })} /></div></div>)}
    <h3 className="font-medium">Default document details</h3><div className="grid gap-4 sm:grid-cols-2">{([['payment_terms', 'Payment terms'], ['payment_methods', 'Payment methods & bank details'], ['terms', 'Terms & conditions'], ['notes', 'Notes']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`billing-default-${key}`}>{label}</Label><Textarea id={`billing-default-${key}`} value={defaults[key]} onChange={e => setDefaults({ ...defaults, [key]: e.target.value })} /></div>)}</div><Button onClick={save} disabled={busy || query.isLoading}>{busy ? 'Saving…' : 'Save billing settings'}</Button>
  </section>;
}