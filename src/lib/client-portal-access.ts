import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { navEntryLocked } from '@/lib/plan-features';

type CommercialStatus = Parameters<typeof navEntryLocked>[0];

/** Invitation controls fail closed while access is loading or unavailable. */
export function canInviteClientContact(status: CommercialStatus) {
  return !!status && !navEntryLocked(status, 'client_portal').locked;
}

export function useClientPortalAccess() {
  const query = useQuery({
    queryKey: ['plan-features'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_commercial_status');
      if (error) throw error;
      return data as CommercialStatus;
    },
  });
  return { allowed: !query.isError && canInviteClientContact(query.data), loading: query.isPending, comingSoon: navEntryLocked(query.data, 'client_portal').soon };
}