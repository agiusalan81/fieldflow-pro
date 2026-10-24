import { expect, it } from 'vitest';
import { canInviteClientContact } from './client-portal-access';

it('does not permit invitations before commercial access is known', () => {
  expect(canInviteClientContact(undefined)).toBe(false);
});
it('locks portal invitations when the optional pack is off', () => {
  expect(canInviteClientContact({ state: 'trial', modules: [{ name: 'client_portal', enabled: false }] })).toBe(false);
});
it('permits invitations when HQ enables the portal pack', () => {
  expect(canInviteClientContact({ state: 'trial', modules: [{ name: 'client_portal', enabled: true }] })).toBe(true);
});
it('keeps Coming soon portal invitations locked even if included in the tier', () => {
  expect(canInviteClientContact({ state: 'trial', modules: [{ name: 'client_portal', enabled: true }], coming_soon_modules: ['client_portal'] })).toBe(false);
});