import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function commercialAccess(role: string, area: 'estimates' | 'contracts' | 'dispatch', override?: boolean | null) {
  return override ?? (area !== 'contracts' ? ['superuser', 'admin', 'supervisor'].includes(role) : ['superuser', 'admin'].includes(role));
}
export function useMemberWorkspaces() {
  return useQuery({ queryKey: ['member-workspaces'], queryFn: async () => {
    const r = await supabase.rpc('my_member_capabilities'); if (r.error) throw r.error;
    return r.data as { estimates: boolean; contracts: boolean; dispatch: boolean; surveys?: boolean };
  } });
}