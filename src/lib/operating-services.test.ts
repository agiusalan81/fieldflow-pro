import { expect,it } from 'vitest';
import { expandServices,toggleServices } from './operating-services';
it('retains multiple selected services independently',()=>{expect(toggleServices(['lifts','electrical'],['cctv'],true)).toEqual(['lifts','electrical','cctv']);expect(toggleServices(['lifts','electrical','cctv'],['electrical'],false)).toEqual(['lifts','cctv']);});
it('preserves previously selected combined trades',()=>{expect(expandServices(['elevator','plumbing'])).toEqual(['lifts','escalators','plumbing']);});