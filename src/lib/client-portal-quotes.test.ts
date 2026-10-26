import { describe, expect, it } from 'vitest';
import { canDecidePortalQuote } from './client-routing';

const q = (status: 'sent' | 'awaiting_confirmation' | 'accepted' | 'declined', valid_until: string) => ({ status, snapshot: { document: { valid_until } } });

describe('portal quote approval', () => {
  it('lets an approver decide a sent, current quote', () => { expect(canDecidePortalQuote(q('sent', '2026-11-30'), true, '2026-10-26')).toBe(true); });
  it('keeps contacts without approval permission view-only', () => { expect(canDecidePortalQuote(q('sent', '2026-11-30'), false, '2026-10-26')).toBe(false); });
  it('blocks expired quotes', () => { expect(canDecidePortalQuote(q('sent', '2026-10-25'), true, '2026-10-26')).toBe(false); });
  it('lets an approver confirm an office-recorded phone acceptance', () => { expect(canDecidePortalQuote(q('awaiting_confirmation', '2026-11-30'), true, '2026-10-26')).toBe(true); });
  it('blocks quotes already decided', () => { expect(canDecidePortalQuote(q('accepted', '2026-11-30'), true, '2026-10-26')).toBe(false); });
});
