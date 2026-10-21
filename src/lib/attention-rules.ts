export const labelKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export function uniqueLabels(values: string[]) {
  const labels = new Map<string, string>();
  for (const value of values) if (value.trim() && !labels.has(labelKey(value))) labels.set(labelKey(value), value.trim().replace(/\s+/g, ' '));
  return [...labels.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
export type Blackout = { start_date: string; end_date: string; roles: string[]; reason: string };
export function matchingBlackouts(rows: Blackout[], role: string, type: string, start: string, end: string) {
  return type === 'Annual' && start && end ? rows.filter(b => b.roles.includes(role) && b.start_date <= end && b.end_date >= start) : [];
}
export function swapApplies(s: { status: string; swap_date: string; end_date?: string | null; manager_approved?: boolean }, date: string) {
  return s.status === 'accepted' && s.manager_approved !== false && s.swap_date <= date && (s.end_date ?? s.swap_date) >= date;
}