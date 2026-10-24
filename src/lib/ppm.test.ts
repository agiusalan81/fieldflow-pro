import { describe, it, expect } from 'vitest';
import { ppmDates, ppmStatus } from './ppm';
describe('native contract maintenance',()=>{
 it('monthly cadence produces 12 visits in a year',()=>expect(ppmDates('2026-01-01','2026-12-31',1)).toHaveLength(12));
 it('every two months produces 6 visits',()=>expect(ppmDates('2026-01-01','2026-12-31',2)).toHaveLength(6));
 it('quarterly produces 4 visits',()=>expect(ppmDates('2026-01-01','2026-12-31',3)).toHaveLength(4));
 it('keeps the original month-end anchor',()=>expect(ppmDates('2026-01-31','2026-03-31',1)).toEqual(['2026-01-31','2026-02-28','2026-03-31']));
 it('does not generate beyond expiry',()=>expect(ppmDates('2026-01-01','2026-02-01',3)).toEqual(['2026-01-01']));
 it('completed visits are never overdue',()=>expect(ppmStatus('2026-01-01','2026-01-03',true,'2026-01-10')).toBe('Completed'));
 it('deadline is inclusive',()=>expect(ppmStatus('2026-01-01','2026-01-03',false,'2026-01-03')).toBe('Due · grace period'));
 it('flags a breached deadline',()=>expect(ppmStatus('2026-01-01','2026-01-03',false,'2026-01-04')).toBe('SLA overdue'));
});
