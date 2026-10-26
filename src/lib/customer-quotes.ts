import { z } from 'zod';

export const quoteLineSchema = z.object({
  id: z.string().uuid(), description: z.string().trim().min(1).max(1000),
  category: z.enum(['labour', 'material', 'service']), unit: z.string().max(30),
  quantity: z.number().finite().positive().max(1_000_000), rate: z.number().finite().min(0).max(100_000_000),
  discount: z.number().finite().min(0).max(100), vat: z.number().finite().min(0).max(100),
});
export const quoteDocumentSchema = z.object({
  kind: z.enum(['estimate', 'proposal']), title: z.string().trim().min(1).max(200),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.string().max(10000), exclusions: z.string().max(10000), payment: z.string().max(5000),
  timeframe: z.string().max(2000), notes: z.string().max(10000), lines: z.array(quoteLineSchema).max(100),
  photos: z.array(z.object({ id: z.string().uuid(), caption: z.string().max(500) })).max(10).default([]),
}).refine(d => d.valid_until >= d.issue_date, { message: 'Validity must not be before issue date' });
export type QuoteLine = z.infer<typeof quoteLineSchema>;
export type QuoteDocument = z.infer<typeof quoteDocumentSchema>;
export type QuoteTotals = { subtotal: number; discount: number; net: number; vat: number; total: number };
export type QuoteSnapshot = {
  reference: string; revision: number; document: QuoteDocument; totals: QuoteTotals;
  company: { name: string; logo?: string | null | undefined; address?: string | null | undefined; vat?: string | null | undefined; primary?: string | null | undefined; footer?: string | null | undefined };
  currency: string; client: string; site?: string | null | undefined; equipment?: string | null | undefined;
  status?: string; signer_name?: string | null; decided_at?: string | null; allow_decision?: boolean;
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function quoteLineTotals(l: QuoteLine) {
  const subtotal = round(l.quantity * l.rate);
  const discount = round(subtotal * l.discount / 100);
  const net = round(subtotal - discount);
  const vat = round(net * l.vat / 100);
  return { subtotal, discount, net, vat, total: round(net + vat) };
}
export function quoteTotals(lines: QuoteLine[] | null | undefined): QuoteTotals {
  return (lines ?? []).reduce((a, l) => {
    const b = quoteLineTotals(l);
    return { subtotal: round(a.subtotal + b.subtotal), discount: round(a.discount + b.discount), net: round(a.net + b.net), vat: round(a.vat + b.vat), total: round(a.total + b.total) };
  }, { subtotal: 0, discount: 0, net: 0, vat: 0, total: 0 });
}
/** Explicit allowlist: supplier metadata and private notes are never projected. */
export function customerQuoteDocument(raw: unknown) { return quoteDocumentSchema.parse(raw); }
export function emptyQuoteDocument(kind: 'estimate' | 'proposal' = 'estimate'): QuoteDocument {
  const now = new Date(); const expiry = new Date(now); expiry.setUTCDate(expiry.getUTCDate() + 30);
  return { kind, title: '', issue_date: now.toISOString().slice(0, 10), valid_until: expiry.toISOString().slice(0, 10), scope: '', exclusions: '', payment: '', timeframe: '', notes: '', lines: [], photos: [] };
}
/** Older CRM drafts omit empty editor fields; default them without changing issued snapshots or write validation. */
export function quoteDraftForEditor(raw: unknown): QuoteDocument {
  const defaults = emptyQuoteDocument();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  const data = raw as Record<string, unknown>;
  return {
    ...defaults,
    kind: data['kind'] === 'proposal' ? 'proposal' : 'estimate',
    ...Object.fromEntries(['title', 'issue_date', 'valid_until', 'scope', 'exclusions', 'payment', 'timeframe', 'notes'].map(key => [key, typeof data[key] === 'string' ? data[key] : defaults[key as keyof QuoteDocument]])),
    lines: Array.isArray(data['lines']) ? data['lines'] as QuoteLine[] : [],
    photos: Array.isArray(data['photos']) ? data['photos'] as QuoteDocument['photos'] : [],
  };
}
export function newQuoteLine(vat = 18): QuoteLine { return { id: crypto.randomUUID(), description: '', category: 'service', unit: 'each', quantity: 1, rate: 0, discount: 0, vat }; }
export function quoteExpired(d: Pick<QuoteDocument, 'valid_until'>, today = new Date().toISOString().slice(0, 10)) { return d.valid_until < today; }
export function quoteBillingLines(d: QuoteDocument) {
  return d.lines.map(l => ({ description: l.description, qty: l.quantity, unit_price: l.quantity ? quoteLineTotals(l).net / l.quantity : 0, kind: 'fixed' as const }));
}