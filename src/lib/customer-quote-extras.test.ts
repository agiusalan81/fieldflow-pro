import { describe, expect, it } from 'vitest';
import { libraryTermText, quoteSuggestions } from './customer-quote-extras';
import { customerQuoteDocument, emptyQuoteDocument } from './customer-quotes';
describe('Estimate reusable entries', () => {
  it('retains common units alongside a custom unit from previous estimates', () => {
    const s = quoteSuggestions([{ lines: [{ unit: 'inspection', description: 'Safety test' }] }]);
    expect(s.units).toContain('hour'); expect(s.units).toContain('each'); expect(s.units).toContain('inspection');
  });
  it('deduplicates historical descriptions and suggests other customer text fields', () => {
    const s = quoteSuggestions([{ title: 'Repair', payment: '30 days', lines: [{ description: 'Safety test' }] }, { lines: [{ description: 'safety test' }] }]);
    expect(s.descriptions).toEqual(['Safety test']); expect(s.payment).toEqual(['30 days']); expect(s.title).toEqual(['Repair']);
  });
  it('copies library payment terms without pricing or formatting markers', () => {
    expect(libraryTermText({ body: 'Fallback', commercial: { terms: '**30 days**', basePrice: 900 } })).toBe('30 days');
  });
  it('retains captioned photos but never accepts a client-supplied storage URL', () => {
    const d = customerQuoteDocument({ ...emptyQuoteDocument(), title: 'Repair', photos: [{ id: '12345678-1234-4234-8234-123456789abc', caption: 'Damaged door', url: 'https://example.com/private' }] });
    expect(d.photos).toEqual([{ id: '12345678-1234-4234-8234-123456789abc', caption: 'Damaged door' }]);
  });
});