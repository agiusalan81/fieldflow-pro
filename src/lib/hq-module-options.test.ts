import { expect, it } from 'vitest';
import { hqModuleOptions } from './hq-module-options';
it('makes new built-in modules selectable in existing FieldBridge tiers', () => {
  expect(hqModuleOptions('fieldbridge', ['core'], [])).toContain('client_management');
  expect(hqModuleOptions('fieldbridge', ['core'], [])).toContain('job_profitability');
});
it('preserves custom module keys without duplicating them', () => {
  expect(hqModuleOptions('other-product', ['core', 'custom'], [{ modules: ['custom', 'extra'] }])).toEqual(['core', 'custom', 'extra']);
});
it('does not leak FieldBridge-only choices to another product', () => {
  expect(hqModuleOptions('other-product', ['core'], [])).not.toContain('client_portal');
});