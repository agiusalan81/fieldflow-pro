import { describe, expect, it } from 'vitest';
import { industryUnits } from './industry-units';
describe('Core industry units', () => {
  it('never suggests lift stops or floors to HVAC tenants', () => {
    const units = industryUnits('HVAC', [], ['stop', 'floor', 'landing', 'custom duct size']);
    expect(units).not.toContain('stop'); expect(units).not.toContain('floor'); expect(units).not.toContain('landing');
    expect(units).toContain('BTU'); expect(units).toContain('custom duct size');
  });
  it('resolves elevator synonyms and company trade keys', () => { expect(industryUnits('Passenger elevators')).toContain('stop'); expect(industryUnits('', ['elevator'])).toContain('floor'); });
  it('includes only configured trades for multi-trade tenants', () => { const units = industryUnits('Electrical', ['plumbing']); expect(units).toContain('circuit'); expect(units).toContain('pipe'); expect(units).not.toContain('landing'); });
  it('unknown trades get only universal units and tenant custom history', () => { expect(industryUnits('General')).toContain('each'); expect(industryUnits('General')).not.toContain('point'); expect(industryUnits('General', [], ['crate'])).toContain('crate'); });
});