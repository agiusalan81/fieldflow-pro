export type WorkspaceKind = 'leave' | 'equipment' | 'store';
export function workspaceMessageValid(body: string) { return body.trim().length > 0 && body.trim().length <= 4000; }
export function scheduledTravelAllowed(scheduled: string | null | undefined, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return !scheduled || scheduled === `${part('year')}-${part('month')}-${part('day')}`;
}
export function defaultJobIncentive(enabled: boolean, cents: number, open: boolean, allJobs = false) { return enabled && (open || allJobs) ? cents : 0; }