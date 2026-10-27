import { commercialTotal, parseCommercial, type Commercial } from './document-blocks';

export type CoverageDraft = { asset_id: string; checklist_id: string; schedule_id: string; price: string; start: string; end: string; months: string; pricing: Commercial };
export function coverageTotal(lines: Pick<CoverageDraft, 'price'>[]) {
  return Math.round(lines.reduce((sum, x) => sum + (Number(x.price) || 0), 0) * 100) / 100;
}
export function coverageDatesValid(lines: Pick<CoverageDraft, 'start' | 'end'>[]) {
  return lines.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.start) && /^\d{4}-\d{2}-\d{2}$/.test(x.end) && x.end > x.start);
}
export function passportCommercial(raw: unknown, general: unknown, doors: unknown): Commercial {
  const c = parseCommercial(raw);
  const g = general && typeof general === 'object' ? general as Record<string, unknown> : {};
  const d = doors && typeof doors === 'object' ? doors as Record<string, unknown> : {};
  const count = (v: unknown, fallback: number) => v !== '' && v !== null && v !== undefined && Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : fallback;
  if (!c.liftPricing) return c;
  const access = count(g['entrances'], c.liftPricing.carAccess);
  return { ...c, liftPricing: { ...c.liftPricing, stops: count(g['stops'], c.liftPricing.stops), landingDoors: count(d['landing_doors'], c.liftPricing.landingDoors), carAccess: access === 2 ? 2 : access === 3 ? 3 : 1 } };
}
export function calculatedCoveragePrice(c: Commercial) { return String(commercialTotal(c) ?? 0); }