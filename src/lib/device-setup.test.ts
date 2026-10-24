import { afterEach, expect, it } from 'vitest';
import { dismissSetup, setupDismissed } from './device-setup';
afterEach(() => localStorage.clear());
it('persists dismissal across reads for the same mobile account', () => {
  expect(setupDismissed('alice')).toBe(false);
  dismissSetup('alice');
  expect(setupDismissed('alice')).toBe(true);
});
it('never dismisses setup for another account', () => {
  dismissSetup('alice');
  expect(setupDismissed('bob')).toBe(false);
});