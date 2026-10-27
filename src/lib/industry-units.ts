import { tradeFamily } from './trade-association';

export const CORE_UNITS = ['each', 'unit', 'set', 'pair', 'pack', 'box', 'lot', 'hour', 'day', 'visit', 'job', 'trip', 'callout', 'lump sum', 'm', 'ft', 'm²', 'm³', 'kg', 'litre'];
const TRADE_UNITS = {
  lifts: ['stop', 'floor', 'landing', 'door', 'lift', 'escalator'],
  hvac: ['BTU', 'kW', 'ton', 'duct', 'vent', '°C', 'bar'],
  electrical: ['point', 'circuit', 'run', 'fitting', 'V', 'A', 'W', 'kW', 'Ω'],
  plumbing: ['fitting', 'pipe', 'outlet', 'bar', 'litre/min'],
};
export function industryUnits(industry = '', trades: readonly string[] = [], history: readonly string[] = []) {
  const families = new Set([industry, ...trades].map(tradeFamily).filter(f => f !== null));
  const relevant = [...families].flatMap(f => TRADE_UNITS[f]);
  const foreign = new Set(Object.entries(TRADE_UNITS).filter(([f]) => !families.has(f as keyof typeof TRADE_UNITS)).flatMap(([, units]) => units).filter(u => !relevant.includes(u)).map(u => u.toLowerCase()));
  const unique = new Map<string, string>();
  for (const raw of [...CORE_UNITS, ...relevant, ...history]) {
    const unit = raw.trim();
    if (unit && !foreign.has(unit.toLowerCase())) unique.set(unit.toLowerCase(), unit);
  }
  return [...unique.values()];
}