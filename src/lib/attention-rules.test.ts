import { describe, it, expect } from 'vitest';
import { labelKey, uniqueLabels, matchingBlackouts, swapApplies } from './attention-rules';
describe('approved attention workflow rules', () => {
  it('Passenger Goods and Passenger goods are the same filter', () => {
    expect(labelKey(' Passenger Goods ')).toBe(labelKey('Passenger goods'));
    expect(uniqueLabels(['Passenger Goods', 'Passenger goods', ' Passenger Goods '])).toEqual(['Passenger Goods']);
  });
  const b = [{ start_date: '2026-11-01', end_date: '2026-11-30', roles: ['technician'], reason: 'Busy month' }];
  it('annual leave blackout applies only to selected roles and dates', () => {
    expect(matchingBlackouts(b, 'technician', 'Annual', '2026-11-05', '2026-11-06')).toHaveLength(1);
    expect(matchingBlackouts(b, 'admin', 'Annual', '2026-11-05', '2026-11-06')).toHaveLength(0);
    expect(matchingBlackouts(b, 'technician', 'Annual', '2026-12-05', '2026-12-06')).toHaveLength(0);
  });
  it('blackouts never restrict sick or other non-annual leave', () => {
    for (const type of ['Sick', 'Training', 'Unpaid']) expect(matchingBlackouts(b, 'technician', type, '2026-11-05', '2026-11-06')).toHaveLength(0);
  });
  it('range swap applies inclusively only after manager approval', () => {
    const s = { swap_date: '2026-11-01', end_date: '2026-11-03', status: 'accepted', manager_approved: false };
    expect(swapApplies(s, '2026-11-02')).toBe(false);
    expect(swapApplies({ ...s, manager_approved: true }, '2026-11-01')).toBe(true);
    expect(swapApplies({ ...s, manager_approved: true }, '2026-11-03')).toBe(true);
    expect(swapApplies({ ...s, manager_approved: true }, '2026-11-04')).toBe(false);
  });
});