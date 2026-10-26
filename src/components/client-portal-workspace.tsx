import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { AlertTriangle, Download, FileText, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { canDecidePortalQuote, quoteNeedsClient, type ClientWorkspace, type PortalQuote } from '@/lib/client-routing';
import { buildCustomerQuotePdf } from '@/lib/customer-quote-pdf';
import { notifyQuoteDecision } from '@/lib/customer-quotes.functions';
import { formatSiteTitle } from '@/lib/site-display';
import { ClientRouting, PortalSiteCodes } from '@/components/client-routing';
import { CustomerQuotePreview } from '@/components/customer-quote-preview';
import { useQuotePhotoUrls } from '@/components/customer-quote-photos';
import { ModulePreview } from '@/components/module-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const money = (n: number, c: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: c }).format(n);
const day = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString() : '';

/** Signed-in client portal: dashboard, service history, quotes, sites/equipment and team access. */
export function ClientPortalWorkspace({ clientId }: { clientId: string }) {
  const qc = useQueryClient(); const notify = useServerFn(notifyQuoteDecision);
  const q = useQuery({ queryKey: ['client-workspace', clientId, true], queryFn: async () => { const r = await supabase.rpc('client_workspace', { _client: clientId }); if (r.error) throw r.error; return r.data as unknown as ClientWorkspace; } });
  const [tab, setTab] = useState('dashboard'); const [search, setSearch] = useState(''); const [quoteFilter, setQuoteFilter] = useState<'pending' | 'all'>('pending');
  const [open, setOpen] = useState<PortalQuote | null>(null); const [decision, setDecision] = useState<'accepted' | 'declined' | null>(null); const [name, setName] = useState(''); const [comment, setComment] = useState(''); const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ asset: string; label: string } | null>(null); const [problem, setProblem] = useState('');
  const data = q.data;
  const photos = useQuotePhotoUrls(open ? { clientId, quoteId: open.id } : undefined, !!open?.snapshot.document.photos?.length);
  const siteName = useMemo(() => (id: string | null) => { const s = data?.sites.find(x => x.id === id); return s ? formatSiteTitle(s) : 'Client-wide'; }, [data]);
  if (q.isPending) return <p role="status">Loading your portal…</p>;
  if (q.error || !data) return <p role="alert" className="text-destructive">Client access is unavailable. Ask the contractor to check your invitation or module access.</p>;
  if (!data.module_on) return <ModulePreview feature="client_portal" title="Client portal" />;
  const refresh = () => qc.invalidateQueries({ queryKey: ['client-workspace', clientId] });
  const quotes = data.quotes ?? []; const assets = data.assets ?? []; const canApprove = !!data.scope.can_approve;
  const pending = quotes.filter(x => quoteNeedsClient(x.status)); const phone = pending.filter(x => x.status === 'awaiting_confirmation');
  const recent = data.sheets.filter(s => Date.now() - new Date(s.created_at).getTime() < 30 * 86400000);
  const term = search.trim().toLowerCase();
  const sheets = data.sheets.filter(s => !term || [s.jobsheet_number, s.reported_fault, s.repairs_performed, s.maintenance_notes, siteName(s.site_id)].some(v => v?.toLowerCase().includes(term)));
  const shownQuotes = quoteFilter === 'pending' ? pending : quotes;
  const download = async (x: PortalQuote) => { try { const bytes = await buildCustomerQuotePdf(x.snapshot, photos.data ?? {}); const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `${x.reference}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); } catch { toast.error('Could not create the PDF'); } };
  const decide = async () => {
    if (!open || !decision) return; setBusy(true);
    const r = await supabase.rpc('portal_decide_quote', { _client: clientId, _quote: open.id, _decision: decision, _name: name, _comment: comment });
    setBusy(false);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(decision === 'accepted' ? 'Quote accepted — your contractor has been notified' : 'Quote declined — your contractor has been notified');
    void notify({ data: { quoteId: open.id } }).catch(() => undefined);
    setOpen(null); setDecision(null); setComment(''); await refresh();
  };
  const sendReport = async () => {
    if (!report) return; setBusy(true);
    const r = await supabase.rpc('portal_report_issue', { _client: clientId, _asset: report.asset, _problem: problem });
    setBusy(false);
    if (r.error) toast.error(r.error.message); else { toast.success('Issue reported to your contractor'); setReport(null); setProblem(''); }
  };
  const statusBadge = (s: PortalQuote['status']) => <Badge variant={s === 'awaiting_confirmation' ? 'destructive' : s === 'sent' ? 'default' : s === 'accepted' ? 'secondary' : 'outline'}>{s === 'awaiting_confirmation' ? 'Confirm phone acceptance' : s === 'sent' ? 'Awaiting decision' : s === 'accepted' ? 'Accepted' : 'Declined'}</Badge>;

  return <>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="sheets">Service sheets</TabsTrigger>
        <TabsTrigger value="quotes">Quotes & estimates{pending.length ? ` (${pending.length})` : ''}</TabsTrigger>
        <TabsTrigger value="sites">Sites & equipment</TabsTrigger>
        <TabsTrigger value="team">{data.scope.admin ? 'Team & access' : 'My details'}</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[['Sites', data.sites.length], ['Equipment', assets.length], ['Visits (30 days)', recent.length]].map(([l, n]) => <div key={l} className="rounded-md border p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="text-2xl font-semibold">{n}</p></div>)}
        </div>
        {phone.map(x => <button key={x.id} type="button" onClick={() => { setTab('quotes'); setOpen(x); setDecision(null); }} className="flex w-full items-center gap-2 rounded-md border border-destructive bg-muted p-3 text-left text-sm font-medium"><AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />Action required: {x.reference} was accepted by phone{x.office_recorded?.name ? ` (${x.office_recorded.name})` : ''}. {canApprove ? 'Please confirm so work can be scheduled.' : 'An authorised approver must confirm before work can be scheduled.'}</button>)}
        {pending.length > phone.length && <button type="button" onClick={() => setTab('quotes')} className="flex w-full items-center gap-2 rounded-md border border-primary bg-muted p-3 text-left text-sm"><AlertTriangle className="h-4 w-4 shrink-0" />{pending.length - phone.length} quote{pending.length - phone.length > 1 ? 's' : ''} awaiting {canApprove ? 'your decision' : 'a decision from an authorised approver'}</button>}
        <section><h2 className="mb-2 font-semibold">Recent visits</h2>{recent.length ? <ul className="divide-y border-y">{recent.slice(0, 8).map(s => <li key={s.id} className="py-2 text-sm"><span className="font-medium">#{s.jobsheet_number}</span> · {day(s.created_at)} · {siteName(s.site_id)}<p className="text-muted-foreground">{s.repairs_performed || s.reported_fault}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No visits in the last 30 days.</p>}</section>
      </TabsContent>

      <TabsContent value="sheets" className="space-y-3">
        <Input aria-label="Search service sheets" placeholder="Search by number, site or work done" value={search} onChange={e => setSearch(e.target.value)} />
        {sheets.length ? <ul className="divide-y border-y">{sheets.map(s => <li key={s.id} className="space-y-1 py-3"><p className="font-medium">#{s.jobsheet_number} · {day(s.created_at)} · {siteName(s.site_id)}</p>{s.reported_fault && <p className="whitespace-pre-wrap text-sm"><span className="text-muted-foreground">Reported: </span>{s.reported_fault}</p>}{s.repairs_performed && <p className="whitespace-pre-wrap text-sm"><span className="text-muted-foreground">Work done: </span>{s.repairs_performed}</p>}{s.maintenance_notes && <p className="whitespace-pre-wrap text-sm"><span className="text-muted-foreground">Maintenance notes: </span>{s.maintenance_notes}</p>}</li>)}</ul> : <p className="text-muted-foreground">No completed sheets found for your sites.</p>}
      </TabsContent>

      <TabsContent value="quotes" className="space-y-3">
        <div className="flex gap-2"><Button size="sm" variant={quoteFilter === 'pending' ? 'default' : 'outline'} onClick={() => setQuoteFilter('pending')}>Awaiting decision</Button><Button size="sm" variant={quoteFilter === 'all' ? 'default' : 'outline'} onClick={() => setQuoteFilter('all')}>All</Button></div>
        {!canApprove && <p className="text-sm text-muted-foreground">You can view quotes for your sites. Accepting or declining requires an authorised approver.</p>}
        {shownQuotes.length ? <ul className="divide-y border-y">{shownQuotes.map(x => <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="font-medium">{x.reference}{x.revision > 1 ? ` rev ${x.revision}` : ''} · {x.snapshot.document.title}</p><p className="text-sm text-muted-foreground">{siteName(x.site_id)} · {money(x.snapshot.totals.total, x.snapshot.currency)} · valid until {x.snapshot.document.valid_until}{x.decided_at && x.status !== 'awaiting_confirmation' ? ` · ${x.status} by ${x.signer_name ?? ''} on ${day(x.decided_at)}` : ''}</p></div><div className="flex items-center gap-2">{statusBadge(x.status)}<Button size="sm" variant="outline" onClick={() => { setOpen(x); setDecision(null); }}><FileText className="mr-1 h-4 w-4" />Review</Button></div></li>)}</ul> : <p className="text-muted-foreground">{quoteFilter === 'pending' ? 'No quotes awaiting a decision.' : 'No quotes issued yet.'}</p>}
      </TabsContent>

      <TabsContent value="sites" className="space-y-4">
        <PortalSiteCodes sites={data.sites} onSaved={() => void refresh()} />
        {data.sites.map(s => { const list = assets.filter(a => a.site_id === s.id); return <section key={s.id} className="space-y-2"><h3 className="font-medium">{formatSiteTitle(s)}</h3>{list.length ? <ul className="divide-y border-y">{list.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><span className="font-medium">{a.reference}</span>{a.category ? ` · ${a.category}` : ''}{a.location ? ` · ${a.location}` : ''}</span><Button size="sm" variant="outline" onClick={() => setReport({ asset: a.id, label: `${a.reference} — ${s.name}` })}><Wrench className="mr-1 h-4 w-4" />Report an issue</Button></li>)}</ul> : <p className="text-sm text-muted-foreground">No equipment registered at this site.</p>}</section>; })}
      </TabsContent>

      <TabsContent value="team"><ClientRouting clientId={clientId} portal /></TabsContent>
    </Tabs>

    <Dialog open={!!open} onOpenChange={o => { if (!o && !busy) setOpen(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{open?.reference} · {open?.snapshot.document.title}</DialogTitle></DialogHeader>
        {open && <div className="space-y-4">
          <CustomerQuotePreview snapshot={open.snapshot} photoAccess={{ clientId, quoteId: open.id }} />
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void download(open)}><Download className="mr-1 h-4 w-4" />Download PDF</Button>
            {canDecidePortalQuote(open, canApprove) && <><Button onClick={() => setDecision('accepted')}>{open.status === 'awaiting_confirmation' ? 'Confirm acceptance' : 'Accept quote'}</Button><Button variant="outline" onClick={() => setDecision('declined')}>Decline</Button></>}</div>
          {open.status === 'awaiting_confirmation' && open.office_recorded && <p role="status" className="rounded-md border border-destructive p-3 text-sm">Your contractor recorded a phone acceptance from {open.office_recorded.name} on {day(open.office_recorded.at)}. Please confirm in writing — work cannot be scheduled until you do.</p>}
          {quoteNeedsClient(open.status) && !canApprove && <p className="text-sm text-muted-foreground">Viewing only — requires approval from an authorised client approver.</p>}
          {decision && <div className="space-y-2 border-t pt-3"><div><Label htmlFor="portal-signer">Your full name</Label><Input id="portal-signer" value={name} maxLength={120} onChange={e => setName(e.target.value)} /></div><div><Label htmlFor="portal-comment">Comment (optional)</Label><Textarea id="portal-comment" maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} /></div><Button disabled={busy || name.trim().length < 2} variant={decision === 'declined' ? 'destructive' : 'default'} onClick={() => void decide()}>{busy ? 'Saving…' : decision === 'accepted' ? 'Confirm acceptance' : 'Confirm decline'}</Button></div>}
        </div>}
      </DialogContent>
    </Dialog>

    <Dialog open={!!report} onOpenChange={o => { if (!o && !busy) setReport(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Report an issue · {report?.label}</DialogTitle></DialogHeader>
        <Label htmlFor="portal-problem">What is the problem?</Label><Textarea id="portal-problem" maxLength={2000} value={problem} onChange={e => setProblem(e.target.value)} placeholder="e.g. Lift stuck on 3rd floor, doors not opening" />
        <p className="text-xs text-muted-foreground">For trapped passengers or danger, also phone your contractor's emergency line.</p>
        <Button disabled={busy || problem.trim().length < 3} onClick={() => void sendReport()}>{busy ? 'Sending…' : 'Send to contractor'}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
