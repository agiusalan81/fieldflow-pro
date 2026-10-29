export function sheetLiftEnabled(inHouse: boolean, packEnabled: boolean) {
  return !inHouse && packEnabled;
}

export function unlistedEquipmentPatch(text: string) {
  const reference = text.trim().slice(0, 500);
  if (!reference) return null;
  return { asset_id: null, unlisted_equipment: reference, requires_admin_approval: true, asset_type: 'Other', asset_type_other: null, lift_model: null, serial_number: null };
}