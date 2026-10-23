import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
export const Route=createFileRoute('/problem/$token')({ staticData: { sitemap: false },head:()=>({meta:[{title:'Report an equipment problem — FieldBridge'},{name:'description',content:'Submit an equipment fault securely to the responsible service team.'},{property:'og:title',content:'Report an equipment problem — FieldBridge'},{property:'og:description',content:'Send a problem report without accessing private equipment records.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:ProblemForm});
function ProblemForm() {
 const { token } = Route.useParams();
 const [f, setF] = useState({ first: '', last: '', position: '', problem: '' });
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
 const send = async (e: React.FormEvent) => {
   e.preventDefault(); if (!target.data || busy) return;
   setBusy(true); setError('');
   try {
     const result = await supabase.rpc('submit_equipment_problem', { _token: token, _first: f.first.trim(), _last: f.last.trim(), _position: f.position.trim(), _problem: f.problem.trim() });
     if (result.error) setError(result.error.message); else setDone(true);
   } catch { setError('Report could not be sent. Please try again.'); }
   finally { setBusy(false); }
 };
 return <main className="mx-auto max-w-lg px-5 py-10">
   <p className="mb-5 text-sm font-medium text-muted-foreground">FieldBridge</p><h1 className="mb-6 text-2xl font-semibold">Report a problem</h1>
   {valid && target.data && <section className="mb-6 border-y py-4"><p className="text-xs text-muted-foreground">Equipment reference</p><h2 className="break-words text-xl font-semibold">{target.data.reference}</h2><p className="break-words text-sm text-muted-foreground">{target.data.category}</p></section>}
   {!valid ? <p role="alert">This reporting link is unavailable.</p> : target.isPending ? <p role="status">Checking equipment…</p> : target.isError ? <div className="space-y-3"><p role="alert">Equipment could not be checked. Please try again.</p><Button variant="outline" onClick={() => target.refetch()}>Retry</Button></div> : !target.data ? <p role="alert">This reporting link is unavailable.</p> : done ? <div role="status" className="space-y-3"><h2 className="font-medium">Report received</h2><p className="text-muted-foreground">Your report has been sent to the service team.</p></div> : <form onSubmit={send} className="space-y-4">
     <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="report-first">Name</Label><Input id="report-first" required maxLength={100} value={f.first} onChange={e => setF({ ...f, first: e.target.value })}/></div><div><Label htmlFor="report-last">Surname</Label><Input id="report-last" required maxLength={100} value={f.last} onChange={e => setF({ ...f, last: e.target.value })}/></div></div>
     <div><Label htmlFor="report-position">Position</Label><Input id="report-position" required maxLength={100} value={f.position} onChange={e => setF({ ...f, position: e.target.value })}/></div>
     <div><Label htmlFor="report-problem">Problem</Label><Textarea id="report-problem" required minLength={5} maxLength={2000} rows={6} value={f.problem} onChange={e => setF({ ...f, problem: e.target.value })}/></div>
     <p className="text-xs text-muted-foreground">For emergencies or trapped passengers, use the emergency contact displayed on the equipment. This form is not an emergency service.</p>
     {error && <p role="alert" className="text-destructive">{error}</p>}<Button className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</Button>
   </form>}
 </main>;
}