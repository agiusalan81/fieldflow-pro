import { commercialTotal, parseCommercial, parseFieldSpecs, type Commercial } from './document-blocks';

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
export function agreementTotal(lines: Pick<CoverageDraft, 'price'>[], mode: string, collective: string) {
  return mode === 'collective' ? Number(collective) || 0 : coverageTotal(lines);
}
export function schedulePricing(doc: { commercial: unknown; field_specs: unknown; items: string[] }, liftEnabled: boolean, passport?: { general: unknown; doors_cabin: unknown }) {
  let pricing = parseCommercial(doc.commercial);
  if (!liftEnabled) pricing = { ...pricing, liftPricing: null };
  else if (passport) pricing = passportCommercial(pricing, passport.general, passport.doors_cabin);
  const itemPrice = parseFieldSpecs(doc.field_specs, doc.items.length).reduce((sum, spec) => sum + (spec.price ?? 0), 0);
  const total = commercialTotal(pricing);
  return { pricing, price: total === null && !itemPrice ? '' : String(total ?? itemPrice), months: pricing.visitsPerYear && [1,2,3,4,6,12].includes(12 / pricing.visitsPerYear) ? String(12 / pricing.visitsPerYear) : '1' };
}