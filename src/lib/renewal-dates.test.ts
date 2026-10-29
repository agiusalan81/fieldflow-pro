import { expect, test } from 'vitest';
import { defaultRenewalDates, renewalDatesValid } from './renewal-dates';
test('manual warranty periods are not forced to twelve months', () => {
  expect(renewalDatesValid('2026-10-29', '2027-04-29')).toBe(true);
  expect(renewalDatesValid('2026-10-29', '2028-10-29')).toBe(true);
});
test('expiry must follow start and be a real calendar date', () => {
  expect(renewalDatesValid('2026-10-29', '2026-10-29')).toBe(false);
  expect(renewalDatesValid('2026-10-29', '2026-10-28')).toBe(false);
  expect(renewalDatesValid('2027-02-30', '2027-04-29')).toBe(false);
});
test('suggested renewal starts the day after expiry', () => {
  expect(defaultRenewalDates('2026-10-29')).toEqual({ start: '2026-10-30', end: '2027-10-29' });
});