import { describe, expect, it } from 'vitest';
import { assignedDocumentIds, coverageTotal, coverageDatesValid, passportCommercial, calculatedCoveragePrice, agreementTotal, schedulePricing } from './agreement-coverage';
import { DEFAULT_COMMERCIAL, DEFAULT_LIFT_PRICING } from './document-blocks';
describe('equipment contract rules', () => {
  it('GL1 inherits its checklist before site/client defaults and excludes GL2',()=>{
    expect(assignedDocumentIds([{master_id:'site',site_id:'S1',asset_id:null},{master_id:'client',site_id:null,asset_id:null},{master_id:'GL2 checklist',site_id:'S1',asset_id:'GL2'},{master_id:'GL1 checklist',site_id:'S1',asset_id:'GL1'}],{id:'GL1',site_id:'S1'})).toEqual(['GL1 checklist','site','client']);
  });
  it('deselected assignments do not seed equipment contracts',()=>expect(assignedDocumentIds([],{id:'GL1',site_id:'S1'})).toEqual([]));
  it('retains asset prices while using a collective agreed total', () => expect(agreementTotal([{price:'1200'},{price:'450'}], 'collective', '1500')).toBe(1500));
  it('uses itemised asset totals rather than a collective override', () => expect(agreementTotal([{price:'1200'},{price:'450'}], 'itemised', '1500')).toBe(1650));
  it('automatically applies a two-stop schedule to actual passport stops', () => expect(schedulePricing({commercial:{basePrice:500,liftPricing:{...DEFAULT_LIFT_PRICING,extraStopRate:50}},field_specs:[],items:[]},true,{general:{stops:5},doors_cabin:{}}).price).toBe('650'));
  it('keeps Core schedule pricing independent of lift dimensions', () => expect(schedulePricing({commercial:{basePrice:500,liftPricing:{...DEFAULT_LIFT_PRICING,extraStopRate:50,stops:5}},field_specs:[],items:[]},false).price).toBe('500'));
  it('aggregates one site contract from separately priced assets', () => expect(coverageTotal([{price:'1200'},{price:'450'}])).toBe(1650));
  it('supports three independent contracts covering two assets each', () => expect([[100,200],[300,400],[500,600]].map(pair => coverageTotal(pair.map(price => ({price:String(price)}))))).toEqual([300,700,1100]));
  it('accepts independent February and September equipment dates', () => expect(coverageDatesValid([{start:'2026-02-01',end:'2027-02-01'},{start:'2026-09-01',end:'2027-09-01'}])).toBe(true));
  it('rejects expiry before equipment starts', () => expect(coverageDatesValid([{start:'2026-09-01',end:'2026-02-01'}])).toBe(false));
  it('prices stops, landing doors and car access independently', () => {
    const c = passportCommercial({...DEFAULT_COMMERCIAL,basePrice:500,liftPricing:{...DEFAULT_LIFT_PRICING,extraStopRate:50,landingDoorRate:20,extraCarDoorRate:75}}, {stops:'5',entrances:'2'}, {landing_doors:'7'});
    expect(calculatedCoveragePrice(c)).toBe('865');
  });
  it('does not infer landing doors from stop count', () => expect(passportCommercial({...DEFAULT_COMMERCIAL,liftPricing:{...DEFAULT_LIFT_PRICING,landingDoors:3}}, {stops:8}, {}).liftPricing?.landingDoors).toBe(3));
});