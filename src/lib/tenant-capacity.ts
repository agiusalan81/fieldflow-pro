import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SeatUsage = { active_members: number; pending_invites: number; seat_limit: number | null; available_seats: number | null };
export function seatLevel(usage: SeatUsage) {
  const committed = usage.active_members + usage.pending_invites;
  const pct = usage.seat_limit === null ? 0 : usage.seat_limit === 0 ? 100 : Math.round(committed / usage.seat_limit * 100);
  return { pct, level: usage.seat_limit === null ? 'unlimited' : committed >= usage.seat_limit ? 'full' : pct >= 90 ? 'critical' : pct >= 80 ? 'warning' : 'ok' } as const;
}
export function useSeatUsage(companyId: string | undefined) {
  return useQuery({ queryKey: ['company-seat-usage', companyId], enabled: !!companyId, refetchInterval: 30000, queryFn: async () => {
    if (!companyId) throw new Error('Company unavailable');
    const r = await supabase.rpc('company_seat_usage', { _company: companyId });
    if (r.error) throw r.error;
    return r.data as SeatUsage;
  } });
}