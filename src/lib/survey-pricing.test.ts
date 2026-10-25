import { describe, expect, it } from 'vitest';
import { clientEstimateView, emptyPricing, pricingTotals, zohoSyncFor } from './survey-pricing';
import { formatSiteDisplay, formatSiteTitle } from './site-display';

describe('price generator', () => {
  const p = { ...emptyPricing(), base: [{ label: 'Supplier package', amount: 1000 }], labour: [{ label: 'Install', people: 2, hours: 10, rate: 50 }], contingencyPct: 0, marginPct: 20, vatPct: 18 };
  it('applies margin on selling price', () => {
    const t = pricingTotals(p);
    expect(t.cost).toBe(2000);
    expect(t.net).toBe(2500);
    expect(t.gross).toBe(2950);
  });
  it('client view hides internal costs', () => {
    const v = clientEstimateView(p);
    expect(Object.keys(v)).not.toContain('cost');
    expect(JSON.stringify(v)).not.toContain('Supplier package');
  });
});

describe('zoho routing', () => {
  it('supplier RFQ track stays in-house by default', () => expect(zohoSyncFor('supplier_rfq', { direct: true, supplier: false })).toBe(false));
  it('direct repair track syncs by default', () => expect(zohoSyncFor('direct', { direct: true, supplier: false })).toBe(true));
  it('per-survey choice overrides', () => expect(zohoSyncFor('direct', { direct: true, supplier: false }, false)).toBe(false));
});

describe('site display', () => {
  it('prefixes branch ID and address', () => expect(formatSiteDisplay({ name: 'Costa', address: 'Valletta', store_code: '104' })).toBe('[#104] Costa — Valletta'));
  it('falls back to name', () => expect(formatSiteTitle({ name: 'Costa', store_code: '' })).toBe('Costa'));
});

import { lineTotal } from "./survey-pricing";
describe("rate units", () => {
  it("multiplies per-day equipment hire by days", () => { expect(lineTotal({ label: "Scaffold", amount: 120, unit: "day", qty: 3 })).toBe(360); });
  it("keeps fixed amounts as-is", () => { expect(lineTotal({ label: "Skip", amount: 90, qty: 5 })).toBe(90); });
});
