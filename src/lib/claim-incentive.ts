/** Convert money text to integer cents without floating-point truncation. */
export function incentiveCents(raw: string): number | null {
  if (!/^\d+(?:\.\d{0,2})?$/.test(raw.trim())) return null;
  const [whole = '0', fraction = ''] = raw.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 100000000 ? cents : null;
}
export const incentiveAmount = (cents: number) => `€${(cents / 100).toFixed(2)}`;

export type IncentiveEntry = { amount_cents: number; earned_at: string | null };
export function payableIncentives<T extends IncentiveEntry & {id:string;user_id:string;payslip_id:string|null}>(rows:T[],userId:string,from:string,to:string) {
 return rows.filter(r=>r.user_id===userId&&r.earned_at!==null&&r.earned_at.slice(0,10)>=from&&r.earned_at.slice(0,10)<=to&&!r.payslip_id).sort((a,b)=>a.id.localeCompare(b.id));
}
export function selfIncentiveLocked(role:string|undefined,actor:string|undefined,crew:string[]) {return role==='supervisor'&&!!actor&&crew.includes(actor);}
export function incentiveTotals(rows: IncentiveEntry[], month: string) {
  return rows.reduce((total, row) => {
    if (!row.earned_at) total.pending += row.amount_cents;
    else {
      total.earned += row.amount_cents;
      if (row.earned_at.slice(0, 7) === month) total.monthEarned += row.amount_cents;
    }
    return total;
  }, { earned: 0, pending: 0, monthEarned: 0 });
}