import {describe,it,expect} from 'vitest';
import {DEFAULT_FLEET_PING_SECONDS,fleetSummary,type FleetPoint} from './fleet';
const p=(longitude:number,time:string,shift_id='s'):FleetPoint=>({id:time,user_id:'u',shift_id,plate:'ABC123',latitude:0,longitude,accuracy:5,recorded_at:time});
describe('Fleet Management',()=>{
 it('no-vehicle shifts never contribute mileage or fuel',()=>{const r=fleetSummary([{...p(0,'2026-10-20T10:00:00Z'),plate:null},{...p(.01,'2026-10-20T10:01:00Z'),plate:null}],[]);expect(r.km).toBe(0);expect(r.litres).toBe(0);expect(r.cost).toBe(0);});
 it('defaults to the requested 30 second ping',()=>expect(DEFAULT_FLEET_PING_SECONDS).toBe(30));
 it('estimates mileage and fuel from a configured vehicle',()=>{const r=fleetSummary([p(0,'2026-10-20T10:00:00Z'),p(.01,'2026-10-20T10:01:00Z')],[{plate:'ABC123',litres_per_100km:8,fuel_price_per_litre:1.5}]);expect(r.km).toBeCloseTo(1.11195,4);expect(r.litres).toBeCloseTo(.088956,5);expect(r.cost).toBeCloseTo(.133434,5);});
 it('never joins separate shifts',()=>expect(fleetSummary([p(0,'2026-10-20T10:00:00Z'),p(.01,'2026-10-20T10:01:00Z','other')],[]).km).toBe(0));
 it('does not invent distance across missing tracking',()=>expect(fleetSummary([p(0,'2026-10-20T10:00:00Z'),p(.01,'2026-10-20T11:00:00Z')],[]).km).toBe(0));
 it('rejects parked GPS jitter',()=>expect(fleetSummary([p(0,'2026-10-20T10:00:00Z'),p(.00001,'2026-10-20T10:01:00Z')],[]).km).toBe(0));
});