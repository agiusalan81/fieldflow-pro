import { describe, expect, it } from 'vitest';
import { sheetLiftEnabled, unlistedEquipmentPatch } from './sheet-equipment';
describe('edition equipment rules', () => {
  it('never enables Lift fields for in-house editions even with pack access', () => expect(sheetLiftEnabled(true, true)).toBe(false));
  it('retains FieldBridge Lift pack controls', () => expect(sheetLiftEnabled(false, true)).toBe(true));
  it('does not enable Lift controls without the pack', () => expect(sheetLiftEnabled(false, false)).toBe(false));
  it('keeps new equipment unregistered and flagged for review', () => expect(unlistedEquipmentPatch(' Cold room 4 ')).toMatchObject({asset_id: null, unlisted_equipment: 'Cold room 4', requires_admin_approval: true}));
  it('does not accept an empty new reference', () => expect(unlistedEquipmentPatch(' ')).toBeNull());
});