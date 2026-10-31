import { describe, expect, it } from 'vitest';
import { billingBalance, billingDocumentSchema, billingPaymentState, billingSourceKind, depositAmount, newBillingDocument } from './client-billing';
const line = { id: '00000000-0000-4000-8000-000000000001', description: 'Agreed work', category: 'service' as const, unit: 'each', quantity: 1, rate: 1000, discount: 0, vat: 18 };
describe('contractor billing rules', () => {
  it('creates proformas from agreed quotes, not invoices', () => expect(billingSourceKind('quote')).toBe('proforma'));
  it('creates payment requests after completed sheets, not invoices', () => expect(billingSourceKind('sheet')).toBe('payment_request'));
  it('calculates a 30 percent deposit on the agreed total including VAT', () => expect(depositAmount([line], 30)).toBe(354));
  it('tracks partial settlement without modifying document totals', () => { expect(billingBalance(1180, 354)).toBe(826); expect(billingPaymentState(1180, 354)).toBe('Partial'); });
  it('supports standalone payment request data and bespoke inline terms', () => expect(billingDocumentSchema.parse(newBillingDocument({ title: 'Standalone work', lines: [line], payment_methods: 'Bank transfer', terms: 'Tenant terms' })).payment_methods).toBe('Bank transfer'));
  it('rejects a due date earlier than issue', () => expect(billingDocumentSchema.safeParse(newBillingDocument({ title: 'Work', lines: [line], issue_date: '2026-10-31', due_date: '2026-10-30' })).success).toBe(false));
  it('rejects VAT charges when explicitly non-VAT registered', () => expect(billingDocumentSchema.safeParse(newBillingDocument({ title: 'Work', lines: [line], tax_exempt: true })).success).toBe(false));
});