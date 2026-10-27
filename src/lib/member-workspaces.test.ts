import { describe, expect, it } from 'vitest';
import { commercialAccess } from './member-workspaces';
describe('per member workspaces', () => {
  it('supervisors can individually be enabled for contracts', () => { expect(commercialAccess('supervisor', 'contracts')).toBe(false); expect(commercialAccess('supervisor', 'contracts', true)).toBe(true); });
  it('different technicians can have different estimating capabilities', () => { expect(commercialAccess('technician', 'estimates', true)).toBe(true); expect(commercialAccess('technician', 'estimates', false)).toBe(false); });
  it('explicit unchecked capability overrides primary role defaults', () => { expect(commercialAccess('supervisor', 'estimates', false)).toBe(false); expect(commercialAccess('admin', 'contracts', false)).toBe(false); });
});