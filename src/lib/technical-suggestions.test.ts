import { describe, it, expect } from 'vitest';
import { technicalSuggestions } from './technical-suggestions';
describe('trade-aware technical suggestions', () => {
  it('retail defaults offer refrigeration without lift contamination', () => { const g=technicalSuggestions('retail','',[],false); expect(g['manufacturer']?.suggestions).toContain('Foster'); expect(g['manufacturer']?.suggestions).not.toContain('Otis'); });
  it('hotel defaults include plumbing and custom trades replace defaults', () => { expect(technicalSuggestions('hotel','',[],false)['manufacturer']?.suggestions).toContain('Grundfos'); expect(technicalSuggestions('hotel','',['Bespoke art restoration'],false)['manufacturer']?.suggestions).toEqual([]); });
  it('contractor HVAC stays HVAC and active lift pack adds lift suggestions', () => { expect(technicalSuggestions('contractor','HVAC',[],false)['model']?.suggestions).not.toContain('Gen2'); expect(technicalSuggestions('contractor','HVAC',[],true)['model']?.suggestions).toContain('Gen2'); });
  it('lift synonyms retain correct domain', () => { expect(technicalSuggestions('contractor','',['Passenger elevators'],false)['manufacturer']?.suggestions).toContain('Otis'); });
});