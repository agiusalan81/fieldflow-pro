import {describe,it,expect} from 'vitest';
import {expenseDetails,expenseInMonth} from './expense-details';
import {sheetWithinHistory} from './sheet-history';
describe('expense details',()=>{
  it('saves the prompted date, amount and category',()=>expect(expenseDetails('2026-10-20','12.45','EUR','fuel')).toEqual({expense_date:'2026-10-20',amount:12.45,currency:'EUR',category_id:'fuel'}));
  it('captures Other inside the expense flow',()=>expect(expenseDetails('2026-10-20','1','EUR','','Parking')).toMatchObject({category_id:null,category_name:'Parking'}));
  it('requires a category',()=>expect(()=>expenseDetails('2026-10-20','1','EUR','')).toThrow());
  it('requires a positive amount',()=>expect(()=>expenseDetails('2026-10-20','0','EUR','fuel')).toThrow());
  it('exports by expense date rather than upload month',()=>expect(expenseInMonth({expense_date:'2026-09-30',created_at:'2026-10-01T00:00:00Z'},'2026-09')).toBe(true));
});
describe('field sheet history',()=>{
  for(const months of [1,3,6,12])it(`limits completed history to ${months} months`,()=>{const now=new Date('2026-10-25T12:00:00Z');const inside=new Date(now);inside.setUTCMonth(inside.getUTCMonth()-months);expect(sheetWithinHistory(inside.toISOString(),months,now)).toBe(true);expect(sheetWithinHistory(new Date(inside.getTime()-1).toISOString(),months,now)).toBe(false);});
});