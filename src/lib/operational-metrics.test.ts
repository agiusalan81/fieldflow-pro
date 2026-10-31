import { describe, it, expect } from 'vitest';
import { reportMetrics, monthRange, metricsCsv,quoteDecisionMetrics } from './operational-metrics';
describe('operational reporting', () => {
  it('uses half-open monthly boundaries', () => { expect(monthRange('2026-12')).toEqual({ start:'2026-12-01T00:00:00.000Z', end:'2027-01-01T00:00:00.000Z' }); expect(() => monthRange('2026-13')).toThrow(); });
  it('does not invent closure times for historical reports', () => {
    const r = reportMetrics([{created_at:'2026-10-01T00:00:00.000Z',closed_at:null,status:'closed',key:'a',label:'Fridge'}, {created_at:'2026-10-02T00:00:00.000Z',closed_at:'2026-10-02T02:00:00.000Z',status:'closed',key:'a',label:'Fridge'}, {created_at:'2026-11-01T00:00:00.000Z',closed_at:null,status:'open',key:'a',label:'Fridge'}],monthRange('2026-10').start,monthRange('2026-10').end);
    expect(r).toMatchObject({received:2,closed:2,open:0,closureHours:2,timedCount:1,hotspots:[{label:'Fridge',count:2}]});
  });
  it('protects exported labels against spreadsheet formulas', () => { expect(metricsCsv([['=bad',2]])).toContain('"\'=bad","2"'); });
  it('counts declined quotes in acceptance denominator, not undecided drafts',()=>{expect(quoteDecisionMetrics(['accepted','declined','draft','sent','awaiting_confirmation'])).toEqual({accepted:1,decisions:2});});
});