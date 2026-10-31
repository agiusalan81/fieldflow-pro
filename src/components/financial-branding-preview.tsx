import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/lib/profile';
import { supabase } from '@/integrations/supabase/client';
import { type PdfTemplate, parseTerms, termsFor } from '@/lib/documents';
import { billingDefaultsFor } from '@/lib/payment-defaults';
import { newBillingDocument, type BillingKind, type BillingSnapshot } from '@/lib/client-billing';
import { emptyQuoteDocument, quoteTotals, type QuoteSnapshot } from '@/lib/customer-quotes';
import { ClientBillingPreview } from './client-billing-preview';
import { CustomerQuotePreview } from './customer-quote-preview';
import { buildBillingPdf } from '@/lib/client-billing-pdf';
import { buildCustomerQuotePdf } from '@/lib/customer-quote-pdf';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
export function FinancialBrandingPreview({ template, logo, kind }: { template: PdfTemplate; logo?: string | undefined; kind: BillingKind | 'estimate' }) {
  const { data: profile } = useProfile();
  const settings = useQuery({ queryKey: ['branding-financial-defaults'], queryFn: async () => { const [company, billing] = await Promise.all([supabase.from('company_settings').select('terms,company_address,vat_number,currency').maybeSingle(), supabase.from('client_billing_settings').select('defaults').maybeSingle()]); if (company.error) throw company.error; return { company: company.data, defaults: billing.data?.defaults }; } });
  const lines = [{ id: '00000000-0000-4000-8000-000000000001', category: 'service' as const, description: 'Agreed maintenance work', unit: 'each', quantity: 1, rate: 100, discount: 0, vat: 18 }];
  const company = { name: profile?.companies?.name || 'Your Company', logo: logo || '', address: settings.data?.company?.company_address || '', vat: settings.data?.company?.vat_number || '', primary: template.primaryColor, footer: template.footer };
  const currency = settings.data?.company?.currency || 'EUR';
  const billing: BillingSnapshot = { kind: kind === 'estimate' ? 'proforma' : kind, reference: 'SAMPLE-00001', template, company, client: { name: 'Sample client', address: 'Sample service address' }, currency, totals: quoteTotals(lines), document: newBillingDocument({ ...billingDefaultsFor(settings.data?.defaults, settings.data?.company?.terms, kind === 'estimate' ? 'proforma' : kind), title: 'Agreed maintenance work', lines, deposit_pct: kind === 'proforma' ? 30 : 0 }) };
  const quote: QuoteSnapshot = { template, reference: 'EST-SAMPLE', revision: 1, company, currency, client: 'Sample client', site: 'Sample service address', totals: quoteTotals(lines), document: { ...emptyQuoteDocument(), title: 'Maintenance estimate', lines, scope: 'Agreed maintenance work', payment: billing.document.payment_terms, exclusions: termsFor(parseTerms(settings.data?.company?.terms), 'estimate') || '' } };
  const download = async () => { try { const bytes = kind === 'estimate' ? await buildCustomerQuotePdf(quote) : await buildBillingPdf(billing); const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `${kind}-sample.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); } catch { toast.error('Could not create sample PDF'); } };
  return <div className="space-y-3"><Button size="sm" variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Sample PDF</Button>{kind === 'estimate' ? <CustomerQuotePreview snapshot={quote} /> : <ClientBillingPreview snapshot={billing} />}</div>;
}