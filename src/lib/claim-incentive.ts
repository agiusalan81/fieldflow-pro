/** Convert money text to integer cents without floating-point truncation. */
export function incentiveCents(raw: string): number | null {
  if (!/^\d+(?:\.\d{0,2})?$/.test(raw.trim())) return null;
  const [whole = '0', fraction = ''] = raw.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 100000000 ? cents : null;
}
export const incentiveAmount = (cents: number) => `€${(cents / 100).toFixed(2)}`;