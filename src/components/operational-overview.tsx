import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download,RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEdition } from '@/lib/plan-features';
import { getOperationalMetrics } from '@/lib/operational-metrics.functions';
import { metricsCsv } from '@/lib/operational-metrics';

export function OperationalOverview() {
  const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7)); const {edition}=useEdition();
  const q=useQuery({queryKey:['operational-metrics',month],queryFn:()=>getOperationalMetrics({data:{month}}),staleTime:60000});
  const d=q.data;
  const cards=d ? [
    ['QR reports received',d.reports.received,'Created in selected month'],['Reports closed',d.reports.closed,'Current status of this month’s reports'],
    ['Reports still open',d.reports.open,'Current status of this month’s reports'],['Mean report closure',d.reports.closureHours===null?'Not recorded':`${d.reports.closureHours.toFixed(1)} h`,`${d.reports.timedCount} timestamped closures · not repair time`],
    ['Completed job sheets',d.completed,'Recorded work end in selected month'],['Open follow-ups',d.followups,'On this month’s completed sheets'],
    ['DWR worked hours',d.workedHours.toFixed(1),`${d.dwrCount} canonical daily reports`],
    ...(edition==='contractor'&&d.quoteDecisions!==null ? [['Quote acceptance',d.quoteDecisions?`${Math.round((d.acceptedQuotes??0)/d.quoteDecisions*100)}%`:'No decisions',`${d.acceptedQuotes} accepted / ${d.quoteDecisions} decisions in month`]]:[]),
  ]:[];
  const download=()=>{if(!d)return;const rows:[string,string|number][]=[['Month (UTC)',month],['As of',d.asOf],...cards.map(([label,value,definition])=>[`${label} — ${definition}`,value] as [string,string|number]),...d.reports.hotspots.map(r=>[`Repeat reports: ${r.label}`,r.count] as [string,number])];const url=URL.createObjectURL(new Blob([metricsCsv(rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`operations-${month}.csv`;a.click();URL.revokeObjectURL(url);};
  return <section className="space-y-4 border-y py-5" aria-label="Operational performance">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Operational performance</h2><div className="flex flex-wrap gap-2"><Input type="month" aria-label="Reporting month" className="w-40" value={month} min="2000-01" max="2100-12" onChange={e=>e.target.value&&setMonth(e.target.value)}/><Button variant="outline" size="icon" aria-label="Refresh performance" disabled={q.isFetching} onClick={()=>q.refetch()}><RefreshCw className="size-4"/></Button><Button variant="outline" disabled={!d||q.isFetching} onClick={download}><Download className="mr-2 size-4"/>Monthly CSV</Button></div></div>
    {q.isPending?<p role="status">Loading performance…</p>:q.error?<p role="alert" className="text-destructive">Performance could not be loaded. Please retry.</p>:<><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label,value,definition])=><article key={label} className="min-w-0 rounded-lg border bg-card p-3"><h3 className="text-sm text-muted-foreground">{label}</h3><p className="my-2 break-words text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{definition}</p></article>)}</div>
    <div className="grid gap-4 sm:grid-cols-2"><div><h3 className="mb-2 font-medium">Repeat report hotspots</h3>{d?.reports.hotspots.length?<ul className="divide-y">{d.reports.hotspots.map(r=><li key={r.label} className="flex justify-between gap-3 py-2 text-sm"><span className="break-words">{r.label}</span><span className="tabular-nums">{r.count}</span></li>)}</ul>:<p className="text-sm text-muted-foreground">No repeated reports this month.</p>}</div><dl className="space-y-2 text-sm text-muted-foreground"><div><dt className="font-medium text-foreground">Equipment downtime / repair MTTR</dt><dd>Not measured: reports do not record outage and restoration times.</dd></div>{edition==='contractor'&&<div><dt className="font-medium text-foreground">First-time fix / billable utilisation</dt><dd>Not measured: repair outcomes and matched billable-time records are incomplete.</dd></div>}<div><dt className="font-medium text-foreground">Reporting window</dt><dd>Calendar month in UTC; current status as of {d?.asOf?new Date(d.asOf).toLocaleString():''}.</dd></div></dl></div></>}
  </section>;
}