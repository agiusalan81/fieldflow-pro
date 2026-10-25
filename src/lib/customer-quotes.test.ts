import { describe, expect, it } from 'vitest';
import { customerQuoteDocument, emptyQuoteDocument, quoteBillingLines, quoteExpired, quoteLineSchema, quoteTotals, type QuoteLine } from './customer-quotes';
const line: QuoteLine = { id: '12345678-1234-4234-8234-123456789abc', description: 'Work', category: 'labour', unit: 'hour', quantity: 2, rate: 100, discount: 10, vat: 18 };
describe('Core customer quotes', () => {
  it('multiplies quantities and applies line discounts before VAT', () => expect(quoteTotals([line])).toEqual({ subtotal: 200, discount: 20, net: 180, vat: 32.4, total: 212.4 }));
  it('calculates VAT separately for differently taxed items', () => expect(quoteTotals([line, { ...line, quantity: 1, rate: 50, discount: 0, vat: 0 }]).total).toBe(262.4));
  it('rejects non-positive quantities', () => expect(quoteLineSchema.safeParse({ ...line, quantity: 0 }).success).toBe(false));
  it('rejects discounts greater than 100 percent', () => expect(quoteLineSchema.safeParse({ ...line, discount: 101 }).success).toBe(false));
  it('strips supplier and private information from customer output', () => {
    const raw = { ...emptyQuoteDocument(), title: 'Repair', private_notes: 'secret', supplier: 'secret', lines: [{ ...line, cost_price: 33 }] };
    const safe = customerQuoteDocument(raw);
    expect(safe).not.toHaveProperty('private_notes'); expect(safe).not.toHaveProperty('supplier'); expect(safe.lines[0]).not.toHaveProperty('cost_price');
  });
  it('includes approved discounts in billing without adding actual labour again', () => expect(quoteBillingLines({ ...emptyQuoteDocument(), lines: [line] })).toEqual([{ description: 'Work', qty: 2, unit_price: 90, kind: 'fixed' }]));
  it('remains valid through the validity date', () => { expect(quoteExpired({ valid_until: '2026-10-25' }, '2026-10-25')).toBe(false); expect(quoteExpired({ valid_until: '2026-10-25' }, '2026-10-26')).toBe(true); });
});