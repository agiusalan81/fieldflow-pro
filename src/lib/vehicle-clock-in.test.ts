import { expect, it } from 'vitest';
import { initialVehicleUse, vehicleShiftFields } from './vehicle-clock-in';
it('stationary staff default to on-site without a plate', () => expect(initialVehicleUse({policy:'flexible',work_mode:'stationary'})).toBe('on_site'));
it('mandatory policy still defaults stationary members to a vehicle', () => expect(initialVehicleUse({policy:'mandatory',work_mode:'stationary'})).toBe('driver'));
it('flexible permits on-site clock-in without a vehicle', () => expect(vehicleShiftFields('flexible','on_site','')).toEqual({vehicle_use:'on_site',vehicle_reg:null}));
it('mandatory rejects on-site clock-in', () => expect(() => vehicleShiftFields('mandatory','on_site','')).toThrow('required'));
it('disabled discards any vehicle plate', () => expect(vehicleShiftFields('disabled','driver','ABC123')).toEqual({vehicle_use:'on_site',vehicle_reg:null}));
it('passengers can use the same van registration as drivers', () => expect(vehicleShiftFields('flexible','passenger','ABC123').vehicle_reg).toBe(vehicleShiftFields('flexible','driver','ABC123').vehicle_reg));