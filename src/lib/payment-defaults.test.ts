import { expect, it } from 'vitest';
import { billingDefaultsFor } from './payment-defaults';
it('copies shared banking and payment terms into each new billing kind', () => {
  for (const kind of ['invoice', 'proforma', 'payment_request'] as const) {
    const d = billingDefaultsFor({ payment_terms: 'Pay in 30 days', payment_methods: 'Bank transfer', bank: { iban: 'MT84 SAMPLE', account_holder: 'Sample Company' } }, {}, kind);
    expect(d.payment_terms).toBe('Pay in 30 days'); expect(d.payment_methods).toContain('IBAN: MT84 SAMPLE'); expect(d.payment_methods).toContain('Account holder: Sample Company');
  }
});
it('uses independent document-specific terms without changing company defaults', () => { const raw = { terms: 'Legacy terms' }; const terms = { invoice: { enabled: true, text: 'Invoice terms' }, proforma: { enabled: true, text: 'Deposit terms' }, payment_request: { enabled: false, text: 'Hidden' } }; expect(billingDefaultsFor(raw, terms, 'invoice').terms).toBe('Invoice terms'); expect(billingDefaultsFor(raw, terms, 'proforma').terms).toBe('Deposit terms'); expect(billingDefaultsFor(raw, terms, 'payment_request').terms).toBe(''); expect(raw.terms).toBe('Legacy terms'); });