import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EQUIPMENT_SYMPTOMS, composeProblem, reporterFields } from '@/lib/quick-report';
export const Route=createFileRoute('/problem/$token')({ staticData: { sitemap: false },head:()=>({meta:[{title:'Report an equipment problem — FieldBridge'},{name:'description',content:'Submit an equipment fault securely to the responsible service team.'},{property:'og:title',content:'Report an equipment problem — FieldBridge'},{property:'og:description',content:'Send a problem report without accessing private equipment records.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:ProblemForm});
function ProblemForm() {
 const { token } = Route.useParams();
 const [f, setF] = useState({ name: '', note: '' });
 const [symptom, setSymptom] = useState('');
 const [more, setMore] = useState(false);
 const [busy, setBusy] = useState(false);
 const [done, setDone] = useState(false);
 const [error, setError] = useState('');
 const valid = /^[a-f0-9]{64}$/.test(token);
 const target = useQuery({ queryKey: ['equipment-report-target', token], enabled: valid, retry: false, queryFn: async () => {
   const result = await supabase.rpc('get_equipment_report_target', { _token: token });
   if (result.error) throw result.error;
   const value = result.data;
   if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value['reference'] !== 'string') return null;
   return { reference: value['reference'], category: typeof value['category'] === 'string' ? value['category'] : '' };
 } });
 const logbook = useQuery({ queryKey: ['equipment-logbook', token], enabled: valid, retry: false, queryFn: async () => {
   const r = await supabase.rpc('get_equipment_logbook', { _token: token });
   if (r.error || !r.data) return null;
   return r.data as unknown as { company: string; next_visit: string | null; visits: { date: string; number: string; type: string }[] };
 } });
 const send = async (e: React.FormEvent) => {
   e.preventDefault(); if (!target.data || busy || !symptom) return;
   setBusy(true); setError('');
   try {
     const who = reporterFields(f.name);
     const result = await supabase.rpc('submit_equipment_problem', { _token: token, _first: who.first, _last: who.last, _position: who.position, _problem: composeProblem({ category: target.data.category, symptom, note: f.note }) });
     if (result.error) setError(result.error.message); else setDone(true);
   } catch { setError('Report could not be sent. Please try again.'); }
   finally { setBusy(false); }
 };
 return <main className="mx-auto max-w-lg px-5 py-10">
   <p className="mb-5 text-sm font-medium text-muted-foreground">FieldBridge</p><h1 className="mb-6 text-2xl font-semibold">Report a problem</h1>
   {valid && target.data && <section className="mb-6 border-y py-4"><p className="text-xs text-muted-foreground">Equipment reference</p><h2 className="break-words text-xl font-semibold">{target.data.reference}</h2><p className="break-words text-sm text-muted-foreground">{target.data.category}</p></section>}
   {valid && target.data && logbook.data && <section className="mb-6 rounded-lg border bg-card p-4"><h2 className="font-semibold">Service logbook</h2><p className="text-xs text-muted-foreground">Maintained by {logbook.data.company}</p>
     {logbook.data.next_visit && <p className="mt-3 text-sm">Next scheduled visit: <span className="font-medium">{new Date(logbook.data.next_visit).toLocaleDateString()}</span></p>}
     {logbook.data.visits.length ? <ul className="mt-3 divide-y text-sm">{logbook.data.visits.map(v => <li key={v.number + v.date} className="flex justify-between gap-3 py-2"><span>{new Date(v.date).toLocaleDateString()} · {v.type}</span><span className="font-mono text-xs text-muted-foreground">{v.number}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No completed visits recorded yet.</p>}
   </section>}
   {!valid ? <p role="alert">This reporting link is unavailable.</p> : target.isPending ? <p role="status">Checking equipment…</p> : target.isError ? <div className="space-y-3"><p role="alert">Equipment could not be checked. Please try again.</p><Button variant="outline" onClick={() => target.refetch()}>Retry</Button></div> : !target.data ? <p role="alert">This reporting link is unavailable.</p> : done ? <div role="status" className="space-y-3"><h2 className="font-medium">Report received</h2><p className="text-muted-foreground">Your report has been sent to the service team.</p></div> : <form onSubmit={send} className="space-y-5">
     <fieldset><legend className="mb-2 text-sm font-medium">What's wrong?</legend><div className="grid grid-cols-2 gap-2">
       {EQUIPMENT_SYMPTOMS.map(s => <Button key={s} type="button" variant={symptom === s ? 'default' : 'outline'} aria-pressed={symptom === s} className="h-14" onClick={() => { setSymptom(s); if (s === 'Other') setMore(true); }}>{s}</Button>)}
     </div></fieldset>
     {!more ? <button type="button" className="text-sm text-primary underline" onClick={() => setMore(true)}>Add details (optional)</button> : <div className="space-y-3 rounded-lg border p-3">
       <div><Label htmlFor="report-problem">Note (optional)</Label><Textarea id="report-problem" maxLength={1500} rows={3} value={f.note} onChange={e => setF({ ...f, note: e.target.value })}/></div>
       <div><Label htmlFor="report-name">Your name (optional)</Label><Input id="report-name" maxLength={100} value={f.name} onChange={e => setF({ ...f, name: e.target.value })}/></div>
     </div>}
     <p className="text-xs text-muted-foreground">For emergencies or trapped passengers, use the emergency contact displayed on the equipment. This form is not an emergency service.</p>
     {error && <p role="alert" className="text-destructive">{error}</p>}<Button className="h-12 w-full" disabled={busy || !symptom}>{busy ? 'Sending…' : 'Send report'}</Button>
   </form>}
 </main>;
}