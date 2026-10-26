import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/locale';
import { Button } from '@/components/ui/button';

/** Related records only; the caller applies role and module gates, and RLS scopes every read. */
export function ClientRecords({ clientId, kind }: { clientId: string; kind: 'quotes' | 'sheets' | 'contracts' }) {
  const query = useQuery({ queryKey: ['client-records', clientId, kind], queryFn: async () => {
    if (kind === 'quotes') {
      const r = await supabase.from('customer_quotes').select('id,reference,status,updated_at').eq('client_id', clientId).order('updated_at', { ascending: false }).limit(100);
      if (r.error) throw r.error;
      return (r.data ?? []).map(q => ({ id: q.id, title: q.reference, detail: q.status.replaceAll('_', ' '), date: q.updated_at }));
    }
    if (kind === 'sheets') {
      const r = await supabase.from('job_sheets').select('id,jobsheet_number,status,created_at,sites(name)').eq('client_id', clientId).order('created_at', { ascending: false }).limit(100);
      if (r.error) throw r.error;
      return (r.data ?? []).map(s => ({ id: s.id, title: s.jobsheet_number ?? 'Job sheet', detail: `${s.status.replaceAll('_', ' ')}${s.sites?.name ? ` · ${s.sites.name}` : ''}`, date: s.created_at }));
    }
    const r = await supabase.from('maintenance_agreements').select('id,status,start_date,end_date,annual_price,contract_types(name)').eq('client_id', clientId).order('end_date', { ascending: false }).limit(100);
    if (r.error) throw r.error;
    return (r.data ?? []).map(a => ({ id: a.id, title: a.contract_types?.name ?? 'Custom agreement', detail: `${a.status} · ${a.start_date} → ${a.end_date} · ${formatMoney(a.annual_price)}`, date: a.start_date }));
  } });
  if (query.isPending) return <p role="status" className="py-6 text-sm text-muted-foreground">Loading records…</p>;
  if (query.isError) return <div className="py-6"><p role="alert" className="text-sm text-destructive">Could not load these records.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>;
  if (!query.data.length) return <p className="py-6 text-sm text-muted-foreground">No {kind === 'sheets' ? 'job sheets' : kind} for this client.</p>;
  return <ul className="divide-y">{query.data.map(r => <li key={r.id} className="flex items-center gap-3 py-3">
    <div className="min-w-0 flex-1"><p className="break-words font-medium">{r.title}</p><p className="break-words text-sm capitalize text-muted-foreground">{r.detail}</p></div>
    {kind !== 'contracts' && <Button asChild variant="ghost" size="icon" aria-label={`Open ${r.title}`} title={`Open ${r.title}`}>{kind === 'quotes' ? <Link to="/estimates" search={{ quote: r.id }}><ArrowUpRight className="h-4 w-4" /></Link> : <Link to="/sheets/$sheetId" params={{ sheetId: r.id }}><ArrowUpRight className="h-4 w-4" /></Link>}</Button>}
  </li>)}</ul>;
}