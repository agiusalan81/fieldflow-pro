import { expect, it } from 'vitest';
import { dispatchEquipmentAtSite } from './dispatch-equipment';
const assets = [{ id: 'a', client_id: 'one', site_id: 's1' }, { id: 'b', client_id: 'one', site_id: 's2' }, { id: 'c', client_id: 'two', site_id: 's1' }];
it('only offers the selected client and site equipment', () => {
  expect(dispatchEquipmentAtSite(assets, 'one', 's1').map(a => a.id)).toEqual(['a']);
});
it('offers all of the client equipment before a site is chosen', () => {
  expect(dispatchEquipmentAtSite(assets, 'one', null).map(a => a.id)).toEqual(['a', 'b']);
});