import { describe, expect, it } from 'vitest';
import { dispatchAvailability } from './dispatch-availability';
describe('dispatch availability', () => {
  it('opens a scheduled unassigned job', () => expect(dispatchAvailability('2026-10-29','none',true,false).open_to_claim).toBe(true));
  it('keeps TBD off the board', () => expect(dispatchAvailability(null,'none',true,false)).toEqual({scheduled_date:null,claim_hold:false,open_to_claim:false}));
  it('honours deliberate hold', () => expect(dispatchAvailability('2026-10-29','none',true,true).open_to_claim).toBe(false));
  it('keeps assigned single-person jobs closed', () => expect(dispatchAvailability('2026-10-29','person',true,false).open_to_claim).toBe(false));
});