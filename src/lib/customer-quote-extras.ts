import { recentSuggestions } from './entry-suggestions';
import { stripRich } from './rich-text';
export const QUOTE_UNITS = ['each', 'unit', 'hour', 'day', 'visit', 'job', 'set', 'pair', 'lot', 'm', 'm²', 'm³', 'kg', 'litre'];
export function quoteSuggestions(documents: unknown[]) {
  const docs = documents.filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && !Array.isArray(d));
  const texts = (key: string) => recentSuggestions(docs.map(d => typeof d[key] === 'string' ? d[key] as string : ''));
  const lines = docs.flatMap(d => Array.isArray(d['lines']) ? d['lines'] as { description?: string; unit?: string }[] : []);
  return { title: texts('title'), scope: texts('scope'), payment: texts('payment'), timeframe: texts('timeframe'), exclusions: texts('exclusions'), notes: texts('notes'), descriptions: recentSuggestions(lines.map(l => l.description)), units: recentSuggestions([...QUOTE_UNITS, ...lines.map(l => l.unit)], 60) };
}
export function libraryTermText(master: { body: string; commercial?: unknown }) {
  const c = master.commercial as { terms?: unknown } | null;
  return stripRich(typeof c?.terms === 'string' && c.terms.trim() ? c.terms : master.body).trim();
}