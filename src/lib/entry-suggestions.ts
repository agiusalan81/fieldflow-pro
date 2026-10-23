/** Recent, case-insensitive unique entries; bounded before rendering. */
export function recentSuggestions(values: (string | null | undefined)[], limit = 30) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value?.trim();
    if (!text || text.length > 2000 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}