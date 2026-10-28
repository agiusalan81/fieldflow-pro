import { describe, expect, it } from 'vitest';
import { commercialAccess } from './member-workspaces';
describe('per member workspaces', () => {
  it('dispatch permission is independent for each supervisor', () => { expect(commercialAccess('supervisor', 'dispatch', true)).toBe(true); expect(commercialAccess('supervisor', 'dispatch', false)).toBe(false); });
  it('supervisors can individually be enabled for contracts', () => { expect(commercialAccess('supervisor', 'contracts')).toBe(false); expect(commercialAccess('supervisor', 'contracts', true)).toBe(true); });
  it('different technicians can have different estimating capabilities', () => { expect(commercialAccess('technician', 'estimates', true)).toBe(true); expect(commercialAccess('technician', 'estimates', false)).toBe(false); });
  it('explicit unchecked capability overrides primary role defaults', () => { expect(commercialAccess('supervisor', 'estimates', false)).toBe(false); expect(commercialAccess('admin', 'contracts', false)).toBe(false); });
});
import { liftCostingAccess } from './member-workspaces';
describe('lift costing availability', () => {
  it('supervisors are locked out unless enabled', () => { expect(liftCostingAccess('supervisor', null)).toBe(false); expect(liftCostingAccess('supervisor', true)).toBe(true); });
  it('admins default on, superusers always on', () => { expect(liftCostingAccess('admin', null)).toBe(true); expect(liftCostingAccess('superuser', false)).toBe(true); });
});
