import { expect, it } from 'vitest';
import { pointsInRange } from './location-audit';
import type { FleetPoint } from './fleet';
it('filters retained GPS history by Malta time including boundaries', () => {
  const points=['2026-10-24T07:00:00Z','2026-10-24T08:00:00Z','2026-10-24T09:00:00Z'].map((recorded_at,i)=>({recorded_at,id:String(i)} as FleetPoint));
  expect(pointsInRange(points,'10:00','11:00').map(p=>p.id)).toEqual(['1','2']);
  expect(pointsInRange(points,'11:00','10:00')).toEqual([]);
});