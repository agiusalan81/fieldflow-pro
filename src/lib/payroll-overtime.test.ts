import { it,expect } from 'vitest';
import { overtimeDetails } from './payroll-overtime';
import { DEFAULT_RULES } from './jobsheets';
const r={id:'r',shift_id:'s',report_date:'2026-10-05',ot15_hours:2,ot20_hours:0,rows:[{kind:'job',title:'Job sheet- 1',place:'Client · Site A',from:'16:30',to:'18:30'},{kind:'job',title:'Job sheet- 2',place:'Client · Site B',from:'08:00',to:'10:00'}],overtime_rules:DEFAULT_RULES};
it('shows site A overtime without attributing standard-time site B',()=>expect(overtimeDetails([r],'ot15')[0]?.activities).toEqual([{title:'Job sheet- 1',place:'Client · Site A',from:'16:30',to:'18:30',hours:2}]));
it('historical sites have unknown interval allocation',()=>{const d=overtimeDetails([{...r,overtime_rules:null}],'ot15')[0];expect(d?.verified).toBe(false);expect(d?.activities[0]?.hours).toBeNull();});
it('does not duplicate the same shift',()=>expect(overtimeDetails([r,{...r,id:'duplicate'}],'ot15')).toHaveLength(1));
it('does not multiply assisting technician personal hours',()=>expect(overtimeDetails([{...r,rows:[{...r.rows[0],note:'Assisting lead'}]}],'ot15')[0]?.activities[0]?.hours).toBe(2));
it('shows only selected rate reports',()=>expect(overtimeDetails([r],'ot20')).toHaveLength(0));
