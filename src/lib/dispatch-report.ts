import { supabase } from '@/integrations/supabase/client';

export const DISPATCH_REFRESH_KEYS = [
  'schedule', 'today-jobs', 'overview', 'jobs',
  'action-notifications', 'equipment-problem-reports', 'attention-overview',
] as const;

/** A saved visit removes only its matching equipment report from the open queue. */
export async function closeDispatchedReport(problemId: string | undefined, assetId: string | null) {
  if (!problemId) return null;
  if (!assetId) return 'The visit was saved, but its equipment no longer matches the report. Close the report separately.';
  const { data, error } = await supabase.from('equipment_problem_reports')
    .update({ status: 'closed' }).eq('id', problemId).eq('asset_id', assetId)
    .select('id').maybeSingle();
  if (error || !data) return 'The visit was saved, but the problem alert could not be cleared. Close the report separately; do not schedule it again.';
  return null;
}