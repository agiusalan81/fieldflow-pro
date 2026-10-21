/** As-built QS (qs_pricing): tally lines, estimate-vs-installed variance. Survey lines never carry prices. */
export type SurveyLine = { id: string; item_id?: string | null; category: string; name: string; unit: string; estimated: number; installed: number; note?: string; photos?: string[] };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Tap counter: never below zero, rounded to cents for measured runs. */
export function tally(line: SurveyLine, step: number): SurveyLine {
  return { ...line, installed: r2(Math.max(0, (Number(line.installed) || 0) + step)) };
}

/** Snapshot proposal quantities (main offer only; optional alternatives excluded) with installed starting at 0. */
export function linesFromProposal(lines: { id: string; item_id?: string | null; category: string; name: string; unit: string; quantity: number; optional?: boolean }[]): SurveyLine[] {
  return lines.filter((l) => !l.optional && l.name.trim()).map((l) => ({ id: crypto.randomUUID(), item_id: l.item_id ?? null, category: l.category, name: l.name, unit: l.unit, estimated: Number(l.quantity) || 0, installed: 0 }));
}

export function variance(line: SurveyLine) {
  const diff = r2((Number(line.installed) || 0) - (Number(line.estimated) || 0));
  const pct = line.estimated ? r2((diff / line.estimated) * 100) : null;
  return { diff, pct, status: diff === 0 ? "match" : diff > 0 ? "over" : "under" } as const;
}

/** Value of the difference at proposal rates (managers only). Lines without a rate are skipped. */
export function varianceValue(lines: SurveyLine[], rateFor: (l: SurveyLine) => number | undefined) {
  return r2(lines.reduce((a, l) => { const rate = rateFor(l); return rate == null ? a : a + variance(l).diff * rate; }, 0));
}
