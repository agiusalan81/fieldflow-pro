export type Availability = 'clocked_in' | 'travelling' | 'standby' | 'sick' | 'leave' | 'off_shift';
export const AVAILABILITY_ORDER: Availability[] = ['travelling', 'clocked_in', 'standby', 'off_shift', 'leave', 'sick'];
export const activeAvailabilityMember = (status: string) => status === 'active';
export function availabilityStatus(shifts: {shift_type: string}[], leaveType?: string, office = false): Availability {
  if (leaveType) return leaveType === 'Sick' && office ? 'sick' : 'leave';
  if (shifts.some(s => s.shift_type === 'travel')) return 'travelling';
  if (shifts.some(s => s.shift_type === 'shift')) return 'clocked_in';
  if (shifts.some(s => s.shift_type === 'standby')) return 'standby';
  return 'off_shift';
}