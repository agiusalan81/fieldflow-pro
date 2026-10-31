import { z } from 'zod';
import type { PdfTemplate } from './documents';
import { quoteLineSchema, quoteTotals, type QuoteLine, type QuoteTotals } from './customer-quotes';

export const BILLING_KINDS = { proforma: 'Proforma invoice', payment_request: 'Payment request', invoice: 'Invoice' } as const;
export type BillingKind = keyof typeof BILLING_KINDS;
export const billingDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(quoteLineSchema).min(1).max(100),
  payment_terms: z.string().max(5000), payment_methods: z.string().max(5000), terms: z.string().max(10000), notes: z.string().max(10000),
  deposit_pct: z.number().finite().min(0).max(100), tax_exempt: z.boolean(),
}).refine(d => d.due_date >= d.issue_date, { message: 'Due date must not precede issue date' })
  .refine(d => !d.tax_exempt || d.lines.every(l => l.vat === 0), { message: 'Non-VAT documents must have zero VAT on all lines' });
export type BillingDocument = z.infer<typeof billingDocumentSchema>;
export type BillingSnapshot = { template?: PdfTemplate | undefined; kind: BillingKind; reference: string; document: BillingDocument; totals: QuoteTotals; currency: string; company: { name: string; address: string; vat: string; logo?: string }; client: { name: string; address: string; email?: string }; source_document_id?: string | null };
export function newBillingDocument(defaults: Partial<BillingDocument> = {}): BillingDocument {
  const date = new Date(); const due = new Date(date); due.setUTCDate(due.getUTCDate() + 30);
  return { title: '', issue_date: date.toISOString().slice(0, 10), due_date: due.toISOString().slice(0, 10), lines: [], payment_terms: '', payment_methods: '', terms: '', notes: '', deposit_pct: 0, tax_exempt: false, ...defaults };
}
export function billingSourceKind(source: 'quote' | 'sheet'): BillingKind { return source === 'quote' ? 'proforma' : 'payment_request'; }
export function billingBalance(total: number, paid: number) { return Math.max(0, Math.round((total - paid) * 100) / 100); }
export function billingPaymentState(total: number, paid: number) { return paid <= 0 ? 'Unpaid' : billingBalance(total, paid) === 0 ? 'Paid' : 'Partial'; }
export function depositAmount(lines: QuoteLine[], percentage: number) { return Math.round(quoteTotals(lines).total * percentage) / 100; }
export function billingNotice(kind: BillingKind) { return kind === 'invoice' ? '' : kind === 'proforma' ? 'Proforma invoice — not a tax invoice.' : 'Payment request — not a tax invoice.'; }
export function billingError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Check the document details';
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Could not complete the billing action';
}