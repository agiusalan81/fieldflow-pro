import { describe, it, expect } from 'vitest';
import { incentiveCents, incentiveAmount } from './claim-incentive';
describe('claim incentives', () => {
  it('supports the requested 25 cent bonus exactly', () => expect(incentiveCents('0.25')).toBe(25));
  it('allows zero to prevent unwanted expense', () => expect(incentiveCents('0')).toBe(0));
  it('supports one cent increments', () => expect(incentiveCents('0.01')).toBe(1));
  it('rejects fractions of a cent', () => expect(incentiveCents('0.251')).toBeNull());
  it('rejects negative bonuses', () => expect(incentiveCents('-1')).toBeNull());
  it('formats euro cents exactly', () => expect(incentiveAmount(25)).toBe('€0.25'));
});