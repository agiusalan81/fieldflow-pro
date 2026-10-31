import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { monthRange, reportMetrics,quoteDecisionMetrics } from './operational-metrics';

export const getOperationalMetrics = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: { month: string }) => { monthRange(d.month); return d; })
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const manager = await db.rpc('is_company_manager');
    const active = await db.rpc('member_is_active', { _user: context.userId });
    if (manager.error || !manager.data || active.error || !active.data) throw new Error('Manager access required');
    const { start, end } = monthRange(data.month);
    async function all<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
      const rows: T[] = [];
      for (let from = 0; ; from += 500) { const r = await read(from, from + 499); if (r.error) throw new Error(r.error.message); rows.push(...(r.data ?? [])); if ((r.data?.length ?? 0) < 500) return rows; }
    }
    const [equipment, stores, sheets, dwr] = await Promise.all([
      all((a,b) => db.from('equipment_problem_reports').select('id,asset_id,status,created_at,closed_at,assets(reference_number)').gte('created_at',start).lt('created_at',end).order('id').range(a,b)),
      all((a,b) => db.from('store_problem_reports').select('id,site_id,category,status,created_at,closed_at,sites(name)').gte('created_at',start).lt('created_at',end).order('id').range(a,b)),
      all((a,b) => db.from('job_sheets').select('id,work_end_time,pending_status,pending_works_future_jobs').eq('status','completed').gte('work_end_time',start).lt('work_end_time',end).order('id').range(a,b)),
      all((a,b) => db.from('daily_work_reports').select('id,worked_hours').is('superseded_by',null).gte('report_date',start.slice(0,10)).lt('report_date',end.slice(0,10)).order('id').range(a,b)),
    ]);
    const reports = reportMetrics([...equipment.map(r => ({...r,key:`equipment:${r.asset_id}`,label:r.assets?.reference_number ?? 'Equipment'})),...stores.map(r => ({...r,key:`store:${r.site_id}:${r.category}`,label:`${r.sites?.name ?? 'Location'} · ${r.category}`}))],start,end);
    const commercial = await db.rpc('member_commercial_can',{_area:'estimates'});
    if (commercial.error) throw new Error(commercial.error.message);
    const quotes = commercial.data ? await all((a,b) => db.from('customer_quotes').select('id,status').gte('decided_at',start).lt('decided_at',end).in('status',['accepted','declined']).order('id').range(a,b)) : null;
    const decisions=quotes?quoteDecisionMetrics(quotes.map(q=>q.status)):null;
    return { month:data.month, asOf:new Date().toISOString(), reports, completed:sheets.length,
      followups:sheets.filter(s => s.pending_works_future_jobs?.trim() && s.pending_status !== 'done').length,
      workedHours:dwr.reduce((n,r) => n+Number(r.worked_hours),0), dwrCount:dwr.length,
      quoteDecisions:decisions?.decisions ?? null, acceptedQuotes:decisions?.accepted ?? null };
  });