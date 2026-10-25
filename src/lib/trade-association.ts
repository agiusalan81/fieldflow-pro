/** Resolve discipline families without replacing tenant-defined display names. */
export function tradeFamily(value: string): "lifts" | "hvac" | "plumbing" | "electrical" | null {
  const words = value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\b(lifts?|elevators?|escalators?|dumbwaiters?)\b/.test(words)) return "lifts";
  if (/\b(hvac|heating|cooling|air conditioning|ac|chillers?|ventilation)\b/.test(words)) return "hvac";
  if (/\b(plumbing|plumbers?|pipework|sanitary|drains?|drainage)\b/.test(words)) return "plumbing";
  if (/\b(electrical|electricians?|power|lighting|solar|ev)\b/.test(words)) return "electrical";
  return null;
}

export const isLiftTrade = (value: string) => tradeFamily(value) === "lifts";
export const companyHasLiftTrade = (industry = "", trades: string[] = []) => [industry, ...trades].some(isLiftTrade);

export function companyTradeOptions(industry = "", trades: string[] = [], equipment: string[] = []) {
  const unique = new Map<string, string>();
  for (const raw of [industry, ...trades, ...equipment]) {
    const value = raw.trim();
    if (value) unique.set(value.toLowerCase(), value);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}