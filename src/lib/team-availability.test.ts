import {describe,it,expect} from 'vitest';
import {activeAvailabilityMember, availabilityStatus} from './team-availability';
describe('live team availability',()=>{
  it('excludes terminated and pending members',()=>{expect(['active','terminated','pending'].filter(activeAvailabilityMember)).toEqual(['active']);});
  it('distinguishes clocked-in staff from off-shift staff',()=>{expect(availabilityStatus([{shift_type:'shift'}])).toBe('clocked_in');expect(availabilityStatus([])).toBe('off_shift');});
  it('distinguishes travel and standby',()=>{expect(availabilityStatus([{shift_type:'travel'},{shift_type:'shift'}])).toBe('travelling');expect(availabilityStatus([{shift_type:'standby'}])).toBe('standby');});
  it('keeps sick leave private outside the office',()=>{expect(availabilityStatus([],'Sick',false)).toBe('leave');expect(availabilityStatus([],'Sick',true)).toBe('sick');});
});