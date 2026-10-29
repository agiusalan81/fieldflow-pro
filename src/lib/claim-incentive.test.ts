import { describe, it, expect } from 'vitest';
import { incentiveCents, incentiveAmount, incentiveTotals } from './claim-incentive';
describe('claim incentives', () => {
  it('supports the requested 25 cent bonus exactly', () => expect(incentiveCents('0.25')).toBe(25));
  it('allows zero to prevent unwanted expense', () => expect(incentiveCents('0')).toBe(0));
  it('supports one cent increments', () => expect(incentiveCents('0.01')).toBe(1));
  it('rejects fractions of a cent', () => expect(incentiveCents('0.251')).toBeNull());
  it('rejects negative bonuses', () => expect(incentiveCents('-1')).toBeNull());
  it('formats euro cents exactly', () => expect(incentiveAmount(25)).toBe('€0.25'));
  it('collects two completed 25 cent claims as 50 cents', () => {
    expect(incentiveTotals([{amount_cents:25,earned_at:'2026-10-29'}, {amount_cents:25,earned_at:'2026-10-30'}], '2026-10').earned).toBe(50);
  });
  it('keeps uncompleted claims pending rather than earned', () => {
    expect(incentiveTotals([{amount_cents:25,earned_at:null}], '2026-10')).toEqual({earned:0,pending:25,monthEarned:0});
  });
  it('counts this month by completion date, not earlier claims', () => {
    expect(incentiveTotals([{amount_cents:25,earned_at:'2026-09-30'}, {amount_cents:25,earned_at:'2026-10-29'}], '2026-10')).toEqual({earned:50,pending:0,monthEarned:25});
  });
});