import { describe, expect, it } from 'vitest';
import { seatLevel } from './tenant-capacity';
describe('shared seat capacity', () => {
  it('includes invitation reservations in the cap', () => expect(seatLevel({ active_members: 2, pending_invites: 1, seat_limit: 3, available_seats: 0 }).level).toBe('full'));
  it('warns at 80 percent', () => expect(seatLevel({ active_members: 3, pending_invites: 1, seat_limit: 5, available_seats: 1 }).level).toBe('warning'));
  it('warns critically at 90 percent', () => expect(seatLevel({ active_members: 8, pending_invites: 1, seat_limit: 10, available_seats: 1 }).level).toBe('critical'));
  it('does not limit legacy or trial seats', () => expect(seatLevel({ active_members: 25, pending_invites: 4, seat_limit: null, available_seats: null }).level).toBe('unlimited'));
  it('shows over-limit existing teams without deleting members', () => expect(seatLevel({ active_members: 12, pending_invites: 0, seat_limit: 5, available_seats: 0 })).toEqual({ pct: 240, level: 'full' }));
});