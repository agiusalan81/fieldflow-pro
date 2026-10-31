import { describe, expect, it } from 'vitest';
import { inviteSendable, teamInviteDestination } from './invite-delivery';

describe('team invitation delivery', () => {
  const now = Date.parse('2026-10-31T09:02:00Z');
  const invite = { email: 'admin.1.hotels@fieldbridgehotels.com', used_at: null, expires_at: '2026-11-14T09:02:00Z' };
  it('allows an unused unexpired invite with its stored recipient', () => expect(inviteSendable(invite, now)).toBe(true));
  it('refuses expired invitations', () => expect(inviteSendable({ ...invite, expires_at: '2026-10-31T09:02:00Z' }, now)).toBe(false));
  it('refuses redeemed invitations', () => expect(inviteSendable({ ...invite, used_at: '2026-10-31T09:00:00Z' }, now)).toBe(false));
  it('refuses missing recipients', () => expect(inviteSendable({ ...invite, email: null }, now)).toBe(false));
  it.each([
    ['hotel', 'https://fieldbridgehotels.com'], ['retail', 'https://aisleopsapp.com'], ['contractor', 'https://fieldbridgeapp.com'],
  ])('keeps %s invitations in their company edition', (engine_edition, origin) => expect(teamInviteDestination({ engine_edition, app_url: '', name: '' }, 'abc').inviteUrl).toBe(`${origin}/join/abc`));
  it('uses the HQ-configured company app, not a browser-supplied link', () => expect(teamInviteDestination({ engine_edition: 'hotel', app_url: 'https://www.fieldbridgehotels.com/', name: 'FieldBridge Hotels' }, 'abc').inviteUrl).toBe('https://www.fieldbridgehotels.com/join/abc'));
  it('rejects insecure destinations', () => expect(() => teamInviteDestination({ engine_edition: 'hotel', app_url: 'http://example.com', name: '' }, 'abc')).toThrow());
});