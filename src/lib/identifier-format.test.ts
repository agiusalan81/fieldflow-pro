import { describe, expect, it } from 'vitest';
import { DEFAULT_IDENTIFIER_RULE, normalizeIdentifier, suggestNextTag, validateIdentifier } from './identifier-format';
describe('company identifier formats', () => {
  const rule = { ...DEFAULT_IDENTIFIER_RULE, prefix: 'fr', uppercase: false, strict: true };
  it('generates fr-01, fr-02, fr-03 using the company rule', () => { expect([1,2,3].map(n => suggestNextTag([], rule, n))).toEqual(['fr-01','fr-02','fr-03']); });
  it('rejects a different tool prefix in strict validation', () => { expect(validateIdentifier('XX-001', {...rule, prefix:'TL', padding:3})).toBe(false); expect(validateIdentifier('TL-001', {...rule, prefix:'TL', padding:3})).toBe(true); });
  it('retains company separators and casing', () => { expect(normalizeIdentifier(' tl/0001 ', {...rule, uppercase:true})).toBe('TL/0001'); });
  it('continues after highest existing number', () => { expect(suggestNextTag(['fr-01','fr-03'],rule)).toBe('fr-04'); });
  it('validates full custom patterns', () => { expect(validateIdentifier('TL-AB123', {...rule,prefix:'TL',pattern_type:'regex',pattern:'[A-Z]{2}[0-9]{3}'})).toBe(true); expect(validateIdentifier('TL-AB123x', {...rule,prefix:'TL',pattern_type:'regex',pattern:'[A-Z]{2}[0-9]{3}'})).toBe(false); });
});