import { normalizePlate, validPlate } from './dwr';
export type VehiclePolicy = 'flexible' | 'mandatory' | 'disabled';
export type VehicleUse = 'driver' | 'passenger' | 'on_site';
export type VehicleSettings = { policy: VehiclePolicy; work_mode: 'mobile' | 'stationary' };
export function initialVehicleUse(settings: VehicleSettings): VehicleUse {
  return settings.policy === 'disabled' || (settings.policy === 'flexible' && settings.work_mode === 'stationary') ? 'on_site' : 'driver';
}
export function vehicleShiftFields(policy: VehiclePolicy, use: VehicleUse, plate: string) {
  if (policy === 'disabled') return {vehicle_use: 'on_site' as const, vehicle_reg: null};
  if (use === 'on_site') {
    if (policy === 'mandatory') throw new Error('Vehicle registration is required for this member.');
    return {vehicle_use: use, vehicle_reg: null};
  }
  if (!validPlate(plate)) throw new Error('Enter 3 letters and 3 numbers for your vehicle registration.');
  return {vehicle_use: use, vehicle_reg: normalizePlate(plate)};
}