// Remembers the order of the last job-sheet list the user opened a sheet from,
// so the sheet page can offer Previous / Next within that same filtered list.
const KEY = "fb.sheet-nav";

export function saveSheetOrder(ids: string[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
}

export function readSheetOrder(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

export function neighbours(ids: string[], current: string): { prev: string | null; next: string | null; index: number; total: number } {
  const i = ids.indexOf(current);
  if (i < 0) return { prev: null, next: null, index: -1, total: ids.length };
  return { prev: i > 0 ? ids[i - 1] : null, next: i < ids.length - 1 ? ids[i + 1] : null, index: i, total: ids.length };
}
