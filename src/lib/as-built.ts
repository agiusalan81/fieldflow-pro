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

/** Phase 5 commercial review: per-line office decision; signed field quantities stay untouched. */
export type ReviewDecision = { decision: "accept" | "estimate" | "adjust"; qty?: number; reason?: string };
export type SurveyReview = Record<string, ReviewDecision>;

/** Quantity to charge: accept installed (default), hold to estimate, or an office-adjusted figure. */
export function finalQty(line: SurveyLine, d?: ReviewDecision): number {
  if (!d || d.decision === "accept") return Number(line.installed) || 0;
  if (d.decision === "estimate") return Number(line.estimated) || 0;
  return r2(Math.max(0, Number(d.qty) || 0));
}

/** Variances still needing a decision; adjustments and held-to-estimate lines need a reason. */
export function unresolved(lines: SurveyLine[], review: SurveyReview): SurveyLine[] {
  return lines.filter((l) => {
    const d = review[l.id];
    if (d && d.decision !== "accept" && !d.reason?.trim()) return true;
    return variance(l).status !== "match" && !d;
  });
}

export function finalAccount(lines: SurveyLine[], review: SurveyReview, rateFor: (l: SurveyLine) => number | undefined) {
  let estimated = 0, final = 0;
  for (const l of lines) { const rate = rateFor(l); if (rate == null) continue; estimated += (Number(l.estimated) || 0) * rate; final += finalQty(l, review[l.id]) * rate; }
  return { estimated: r2(estimated), final: r2(final), difference: r2(final - estimated) };
}
