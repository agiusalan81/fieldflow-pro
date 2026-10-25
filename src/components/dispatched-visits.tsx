import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeleteVisit } from "@/components/delete-visit";
import { EditVisit } from "@/components/edit-visit";
import { useSearch } from '@tanstack/react-router';

export function DispatchedVisits() {
  const search = useSearch({ strict: false }) as { quoteJob?: string };
  const { data = [], isPending, error } = useQuery({
    queryKey: ["dispatched-visits", search.quoteJob],
    queryFn: async () => {
      const query = supabase.from("jobs").select("id, job_number, scheduled_date, problem_summary, clients(name), sites(name)");
      const result = await (search.quoteJob ? query.eq('id', search.quoteJob) : query.gte("scheduled_date", new Date().toISOString().slice(0, 10))).order("scheduled_date").limit(100);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  return <section className="mb-6 space-y-3">
    <h2 className="text-lg font-semibold">{search.quoteJob ? 'Quote-linked visit' : 'Dispatched visits'}</h2>
    {error ? <p role="alert" className="text-sm text-destructive">Visits could not be loaded.</p> : isPending ? <p className="text-sm text-muted-foreground">Loading visits…</p> : !data.length ? <p className="text-sm text-muted-foreground">No upcoming dispatched visits.</p> : <ul className="divide-y border-y">{data.map(job => <li key={job.id} className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1"><p className="break-words font-medium">#{job.job_number} · {job.clients?.name}{job.sites ? ` · ${job.sites.name}` : ""}</p><p className="text-xs text-muted-foreground">{new Date(job.scheduled_date + "T00:00").toLocaleDateString()}</p><p className="line-clamp-2 text-sm text-muted-foreground">{job.problem_summary}</p></div>
      <EditVisit visit={job} />
      <DeleteVisit id={job.id} number={job.job_number} />
    </li>)}</ul>}
  </section>;
}