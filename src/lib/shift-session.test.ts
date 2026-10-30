import { expect, it } from 'vitest';
import { canSignOutAfterShiftCheck, isLoadedTestSession } from './shift-session';

it('requires clock-out before voluntary sign-out', () => {
  expect(canSignOutAfterShiftCheck(true)).toBe(false);
  expect(canSignOutAfterShiftCheck(false)).toBe(true);
});
it('keeps the session when shift status cannot be verified', () => {
  expect(canSignOutAfterShiftCheck(undefined)).toBe(false);
});
it('recognizes only the currently loaded test account for the inactivity exemption', () => {
  const saved = JSON.stringify({ targetId: 'tech', refresh_token: 'test-only-placeholder' });
  expect(isLoadedTestSession('tech', saved)).toBe(true);
  expect(isLoadedTestSession('other', saved)).toBe(false);
  expect(isLoadedTestSession('tech', '{')).toBe(false);
  expect(isLoadedTestSession('tech', JSON.stringify({ targetId: 'tech' }))).toBe(false);
});