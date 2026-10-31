export type IdentifierRule = { prefix: string; separator: string; padding: number; pattern_type: string; pattern: string; uppercase: boolean; strict: boolean; use_equipment_prefixes?: boolean; equipment_prefixes?: unknown };
export const DEFAULT_IDENTIFIER_RULE: IdentifierRule = { prefix: '', separator: '-', padding: 2, pattern_type: 'numeric', pattern: '', uppercase: true, strict: false };
export function normalizeIdentifier(value: string, rule: IdentifierRule) {
  const clean = value.trim(); return rule.uppercase ? clean.toUpperCase() : clean;
}
export function validateIdentifier(value: string, rule: IdentifierRule) {
  const lead = rule.prefix + rule.separator;
  if (!value.startsWith(lead)) return false;
  const body = value.slice(lead.length);
  try { return new RegExp(`^(?:${rule.pattern_type === 'numeric' ? `[0-9]{${rule.padding},}` : rule.pattern_type === 'alphanumeric' ? '[A-Za-z0-9]+' : rule.pattern})$`).test(body) && !!body; } catch { return false; }
}
export function suggestNextTag(existing: string[], rule: IdentifierRule, offset = 1) {
  const lead = rule.prefix + rule.separator;
  const max = existing.reduce((n, raw) => { const v = normalizeIdentifier(raw, rule); const body = v.slice(lead.length); return v.startsWith(lead) && /^\d+$/.test(body) ? Math.max(n, Number(body)) : n; }, 0);
  return normalizeIdentifier(`${lead}${String(max + offset).padStart(rule.padding, '0')}`, rule);
}