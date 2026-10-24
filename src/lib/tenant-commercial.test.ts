import { describe, expect, it } from 'vitest';
import { itemAccess, validSample } from './tenant-commercial';
const basic = { id: 'basic', kind: 'plan', modules: ['core'] };
const pack = { id: 'portal', kind: 'pack', modules: ['client_portal'] };
describe('Tenant commercial access', () => {
  it('marks only the assigned paid tier subscribed', () => { expect(itemAccess(basic,{state:'active',plan_id:'basic'}).label).toBe('Subscribed'); expect(itemAccess(pack,{state:'active',plan_id:'basic'}).label).toBe('Available'); });
  it('shows restricted trial packs off when their modules are disabled', () => { expect(itemAccess(pack,{state:'trial',trial_package_only:true,modules:[{name:'client_portal',enabled:false}]}).available).toBe(false); });
  it('distinguishes full trial access from subscribing to every tier', () => { expect(itemAccess(pack,{state:'trial',modules:[{name:'client_portal',enabled:true}]})).toEqual({label:'Included in trial access',assigned:false,available:true}); });
  it('never treats empty storage modules as trial entitlement', () => { expect(itemAccess({id:'storage',kind:'pack',modules:[]},{state:'trial'}).available).toBe(false); });
  it('preserves paid assignment while access is paused', () => { expect(itemAccess(pack,{state:'read_only',pack_ids:['portal']}).label).toBe('Assigned · access paused'); });
  it('shows legacy access without asserting payment', () => { expect(itemAccess(pack,{state:'legacy'}).label).toBe('Legacy access'); });
  it('accepts sample PDFs and rejects executable uploads', () => { expect(validSample({name:'sample.pdf',size:100})).toBe(true); expect(validSample({name:'sample.exe',size:100})).toBe(false); });
});it('lower tiers under an active trial tier read as included in trial access', () => { expect(itemAccess({id:'basic',kind:'plan',modules:['core']},{state:'trial',plan_id:'enterprise',modules:[]},true).label).toBe('Included in trial access'); });
