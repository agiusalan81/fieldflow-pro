import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { usePreviewProfile } from '@/lib/impersonation';
import { incentiveAmount, incentiveTotals } from '@/lib/claim-incentive';

function useMyIncentives() {
  const { data: profile } = usePreviewProfile();
  const visibility = useQuery({
    queryKey: ['staff-incentive-visibility', profile?.id, profile?.company_id],
    enabled: !!profile, refetchInterval: 15000,
    queryFn: async () => {
      const r = await supabase.rpc('staff_incentives_visible');
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const ledger = useQuery({
    queryKey: ['my-incentives', profile?.id, profile?.company_id],
    enabled: !!profile && visibility.data === true, refetchInterval: 15000,
    queryFn: async () => {
      if (!profile) return [];
      const fetchPage = (offset: number) => supabase.from('job_claim_incentives')
        .select('id,job_id,amount_cents,claimed_at,earned_at,sheet_id,jobs(job_number)')
        .eq('user_id', profile.id).order('claimed_at', { ascending: false }).order('id').range(offset, offset + 499);
      const first = await fetchPage(0);
      if (first.error) throw first.error;
      const rows = [...(first.data ?? [])];
      let pageSize = first.data?.length ?? 0;
      for (let offset = 500; pageSize === 500; offset += 500) {
        const page = await fetchPage(offset);
        if (page.error) throw page.error;
        rows.push(...(page.data ?? []));
        pageSize = page.data?.length ?? 0;
      }
      return rows;
    },
  });
  return { visible: visibility.data === true, ledger };
}

/** Staff-only screen content, never embedded in client PDFs or emails. */
export function JobIncentiveBadge({ jobId }: { jobId: string | null | undefined }) {
  const { visible, ledger } = useMyIncentives();
  const entry = ledger.data?.find(row => row.job_id === jobId);
  if (!visible || !entry) return null;
  return <p className="text-sm font-medium text-primary">Incentive: {incentiveAmount(entry.amount_cents)} · {entry.earned_at ? 'Earned' : 'Pending completion'}</p>;
}

export function MyIncentives({ compact = false }: { compact?: boolean }) {
  const { visible, ledger } = useMyIncentives();
  if (!visible) return null;
  const totals = incentiveTotals(ledger.data ?? [], new Date().toISOString().slice(0, 7));
  return <section aria-label="My incentives" className="space-y-3 border-y py-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">My incentives</h2>{compact && <Link to="/hours" className="text-sm text-primary">View details</Link>}</div>
    {ledger.error ? <p role="alert" className="text-sm text-destructive">Could not load incentives.</p> : ledger.isPending ? <p className="text-sm text-muted-foreground">Loading incentives…</p> : <>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([['Earned this month', totals.monthEarned], ['Pending completion', totals.pending], ['Total earned', totals.earned]] as const).map(([label, cents]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xl font-semibold tabular-nums">{incentiveAmount(cents)}</dd></div>)}
      </dl>
      {!compact && (!ledger.data?.length ? <p className="text-sm text-muted-foreground">No claimed incentives yet.</p> : <ul className="max-h-80 overflow-y-auto divide-y">{ledger.data.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div><Link to="/schedule" className="font-medium text-primary">Job #{row.jobs?.job_number ?? '—'}</Link><p className="text-xs text-muted-foreground">Claimed {new Date(row.claimed_at).toLocaleDateString()}{row.earned_at ? ` · Earned ${new Date(row.earned_at).toLocaleDateString()}` : ''}</p></div><span>{incentiveAmount(row.amount_cents)} · {row.earned_at ? 'Earned' : 'Pending completion'}</span>{row.sheet_id && <Link to="/sheets/$sheetId" params={{ sheetId: row.sheet_id }} className="text-primary">Job sheet</Link>}</li>)}</ul>)}
    </>}
  </section>;
}