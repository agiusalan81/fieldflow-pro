import { parseTerms, termsFor } from './documents';
import type { BillingDocument, BillingKind } from './client-billing';
export const BANK_FIELDS = [['bank_name', 'Bank name'], ['account_holder', 'Account holder'], ['iban', 'IBAN'], ['bic', 'BIC / SWIFT'], ['account_number', 'Account number'], ['payment_reference', 'Payment reference instructions']] as const;
export type PaymentDefaults = { payment_terms: string; payment_methods: string; terms: string; notes: string; bank: Record<typeof BANK_FIELDS[number][0], string> };
export function paymentDefaults(raw: unknown): PaymentDefaults {
  const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const bank = r.bank && typeof r.bank === 'object' ? r.bank as Record<string, unknown> : {};
  const text = (v: unknown) => typeof v === 'string' ? v : '';
  return { payment_terms: text(r.payment_terms), payment_methods: text(r.payment_methods), terms: text(r.terms), notes: text(r.notes), bank: Object.fromEntries(BANK_FIELDS.map(([key]) => [key, text(bank[key])])) as PaymentDefaults['bank'] };
}
export function billingDefaultsFor(raw: unknown, terms: unknown, kind: BillingKind): Partial<BillingDocument> {
  const d = paymentDefaults(raw); const parsed = parseTerms(terms);
  const configured = !!terms && typeof terms === 'object' && Object.hasOwn(terms, kind);
  return { payment_terms: d.payment_terms, payment_methods: [d.payment_methods, ...BANK_FIELDS.filter(([key]) => d.bank[key].trim()).map(([key, label]) => `${label}: ${d.bank[key].trim()}`)].filter(Boolean).join('\n'), terms: configured ? termsFor(parsed, kind) ?? '' : d.terms, notes: d.notes };
}