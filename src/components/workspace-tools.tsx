import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, ClipboardList, Calculator, UserPlus, Clock, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NewLeadDialog } from '@/components/crm-pipeline';

type Destination = { to: string; label: string; group: string; locked?: boolean };
export function WorkspaceSearch({ items, userId }: { items: Destination[]; userId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const allowed = items.filter(i => !i.locked);
  const clientsOn = allowed.some(i => i.to === '/admin/entities');
  const quotesOn = allowed.some(i => i.to === '/estimates');
  const sheetsOn = allowed.some(i => i.to === '/sheets' || i.to === '/admin/jobs');
  useEffect(() => { const timer = setTimeout(() => setTerm(text.trim().replace(/[%_,()]/g, ' ').trim()), 250); return () => clearTimeout(timer); }, [text]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(v => !v); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  const results = useQuery({ queryKey: ['workspace-search', userId, term, clientsOn, quotesOn, sheetsOn], enabled: open && term.length >= 2, queryFn: async () => {
    const pattern = `%${term}%`;
    const [clients, sites, assets, quotes, sheets] = await Promise.all([
      clientsOn ? supabase.from('clients').select('id,name').ilike('name', pattern).limit(8) : Promise.resolve({ data: [], error: null }),
      clientsOn ? supabase.from('sites').select('id,client_id,name,address').or(`name.ilike.${pattern},address.ilike.${pattern}`).limit(8) : Promise.resolve({ data: [], error: null }),
      clientsOn ? supabase.from('assets').select('id,client_id,reference_number').ilike('reference_number', pattern).limit(8) : Promise.resolve({ data: [], error: null }),
      quotesOn ? supabase.from('customer_quotes').select('id,reference,status').ilike('reference', pattern).limit(8) : Promise.resolve({ data: [], error: null }),
      sheetsOn ? supabase.from('job_sheets').select('id,jobsheet_number,status').ilike('jobsheet_number', pattern).limit(8) : Promise.resolve({ data: [], error: null }),
    ]);
    if (clients.error || sites.error || assets.error || quotes.error || sheets.error) throw new Error('Could not search records');
    return { clients: clients.data ?? [], sites: sites.data ?? [], assets: assets.data ?? [], quotes: quotes.data ?? [], sheets: sheets.data ?? [] };
  } });
  const destinations = allowed.filter(i => `${i.label} ${i.group}`.toLowerCase().includes(text.toLowerCase()));
  const row = 'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent';
  return <>
    <Button variant="ghost" size="icon" aria-label="Search FieldBridge" title="Search FieldBridge" onClick={() => setOpen(true)}><Search className="h-5 w-5" /></Button>
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setText(''); setTerm(''); } }}><DialogContent className="gap-3 sm:max-w-xl"><DialogHeader><DialogTitle>Search FieldBridge</DialogTitle></DialogHeader>
      <Input autoFocus aria-label="Search pages and records" placeholder="Client, site, equipment, quote or job number…" value={text} onChange={e => setText(e.target.value)} />
      <div className="max-h-[60vh] overflow-y-auto" onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        {results.isFetching && <p role="status" className="p-3 text-sm text-muted-foreground">Searching…</p>}
        {results.isError && <p role="alert" className="p-3 text-sm text-destructive">Could not search records. Please try again.</p>}
        {term.length >= 2 && results.data && <div className="mb-3 border-b pb-3">
          {results.data.clients.map(c => <Link key={c.id} to="/admin/entities" search={{ client: c.id }} className={row}>{c.name}<span className="text-xs text-muted-foreground">Client</span></Link>)}
          {results.data.sites.map(s => <Link key={s.id} to="/admin/entities" search={{ client: s.client_id }} className={row}><span className="min-w-0 break-words">{s.name} · {s.address}</span><span className="text-xs text-muted-foreground">Site</span></Link>)}
          {results.data.assets.map(a => <Link key={a.id} to="/admin/entities" search={{ client: a.client_id }} className={row}>{a.reference_number}<span className="text-xs text-muted-foreground">Equipment</span></Link>)}
          {results.data.quotes.map(q => <Link key={q.id} to="/estimates" search={{ quote: q.id }} className={row}>{q.reference}<span className="text-xs capitalize text-muted-foreground">{q.status.replaceAll('_', ' ')}</span></Link>)}
          {results.data.sheets.map(s => <Link key={s.id} to="/sheets/$sheetId" params={{ sheetId: s.id }} className={row}>{s.jobsheet_number}<span className="text-xs capitalize text-muted-foreground">{s.status}</span></Link>)}
          {!Object.values(results.data).some(rows => rows.length) && <p className="p-3 text-sm text-muted-foreground">No matching records.</p>}
        </div>}
        {destinations.map(i => <Link key={i.to} to={i.to} className={row}><span>{i.label}<span className="block text-xs text-muted-foreground">{i.group}</span></span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></Link>)}
      </div>
    </DialogContent></Dialog>
  </>;
}

export function WorkspaceCreate({ manager, field, estimates, crm, company, mobile = false }: { manager: boolean; field: boolean; estimates: boolean; crm: boolean; company?: string; mobile?: boolean }) {
  const [leadOpen, setLeadOpen] = useState(false);
  const navigate = useNavigate();
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button size={mobile ? 'icon' : 'sm'} aria-label="New action" data-tour="new-sheet" className={mobile ? 'mx-auto -mt-5 mb-1.5 h-14 w-14 rounded-full shadow-lg' : ''}><Plus className="h-5 w-5" />{!mobile && <span>New</span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64">
      {manager && <DropdownMenuItem asChild><Link to="/admin/jobs" search={{ new: true }}><ClipboardList />Dispatch / schedule visit</Link></DropdownMenuItem>}
      {field && <DropdownMenuItem asChild><Link to="/sheets/new" search={{}}><ClipboardList />New job sheet</Link></DropdownMenuItem>}
      {estimates && <DropdownMenuItem asChild><Link to="/estimates" search={{ new: true }}><Calculator />New estimate / proposal</Link></DropdownMenuItem>}
      {crm && <DropdownMenuItem data-tour="quick-lead" onSelect={() => setLeadOpen(true)}><UserPlus />New lead</DropdownMenuItem>}
      <DropdownMenuItem asChild><Link to="/dashboard" hash="shift-tracker"><Clock />Clock & travel</Link></DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    {leadOpen && <NewLeadDialog open={leadOpen} onOpenChange={setLeadOpen} company={company} onCreated={id => void navigate({ to: '/crm', search: { lead: id } })} />}
  </>;
}