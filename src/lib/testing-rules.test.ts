import { describe, expect, it } from 'vitest';
import { dwrEligible, isMobileDevice, nextWeekday, passwordsMatch } from './testing-rules';
describe('reported testing rules', () => {
  it('does not treat Windows laptops as phones', () => { expect(isMobileDevice('Windows NT 10.0 Chrome')).toBe(false); expect(isMobileDevice('Android Mobile')).toBe(true); });
  it('requires matching signup passwords', () => { expect(passwordsMatch('abcdef12', 'abcdef13')).toBe(false); expect(passwordsMatch('abcdef12', 'abcdef12')).toBe(true); });
  it('limits DWR filters to technicians and supervisors', () => { expect(['admin','superuser','maintenance','technician','supervisor'].filter(dwrEligible)).toEqual(['technician','supervisor']); });
  it('anchors weekly and fortnightly handovers to the chosen weekday', () => { expect(nextWeekday('2026-10-24', 1)).toBe('2026-10-26'); expect(nextWeekday('2026-10-26', 1)).toBe('2026-10-26'); });
});