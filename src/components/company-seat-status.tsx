import { Link } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { useSeatUsage, seatLevel } from '@/lib/tenant-capacity';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export function CompanySeatStatus({ companyId, canManagePlan = false }: { companyId: string; canManagePlan?: boolean }) {
  const q = useSeatUsage(companyId);
  if (q.error) return <p role="alert" className="text-sm text-destructive">Team capacity could not be checked. Try again before inviting staff.</p>;
  if (!q.data) return <p className="text-sm text-muted-foreground">Checking team capacity…</p>;
  const usage = q.data;
  const state = seatLevel(usage);
  return <section className="space-y-2 border-y py-4" aria-label="Team capacity">
    <h2 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4"/>Team seats</h2>
    <p className="text-sm">{usage.active_members} active · {usage.pending_invites} reserved by invitations · {usage.seat_limit === null ? 'No enforced limit (trial / legacy / custom)' : `${usage.seat_limit} licensed`}</p>
    {usage.seat_limit !== null && <><Progress value={Math.min(100, state.pct)} aria-label="Team seats committed"/><p className="text-sm text-muted-foreground">{usage.available_seats} seats available</p></>}
    {['warning', 'critical', 'full'].includes(state.level) && <p role="status" className="text-sm text-destructive">{state.level === 'full' ? 'No seats available for new invitations. Existing staff retain access. Revoke unused invitations or request more seats.' : 'Your team is nearing its seat allowance. Plan for extra seats before inviting more staff.'}</p>}
    {canManagePlan && state.level !== 'unlimited' && <Button asChild size="sm" variant="outline"><Link to="/subscription">Review plan & capacity</Link></Button>}
  </section>;
}