import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Copy, Send, ShieldOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { clientRecipients } from '@/lib/client-recipients';
import { sendClientBilling } from '@/lib/client-billing.functions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
export function ClientBillingSharing({ id, clientId }: { id: string; clientId: string }) {
  const send = useServerFn(sendClientBilling); const [contact, setContact] = useState(''); const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['billing-recipients', clientId], queryFn: () => clientRecipients(supabase, clientId, null, 'invoice', 'email') });
  const run = async (action: () => Promise<void>) => { setBusy(true); try { await action(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not share document'); } finally { setBusy(false); } };
  return <div className="flex flex-wrap items-end gap-2 border-t pt-4"><div className="min-w-0 flex-1"><Label htmlFor="billing-recipient">Billing contact</Label><select id="billing-recipient" className="h-10 w-full rounded-md border bg-background px-3 text-foreground" value={contact} onChange={e => setContact(e.target.value)}><option value="">Choose billing contact…</option>{q.data?.map(c => <option key={c.id} value={c.id}>{c.first_name} · {c.email}</option>)}</select></div><Button disabled={busy || !contact} onClick={() => run(async () => { const r = await send({ data: { documentId: id, contactId: contact } }); if (r.sent) toast.success('Email accepted for sending'); else toast.error('This recipient cannot receive app emails'); })}><Send className="mr-2 h-4 w-4" />Email document</Button><Button variant="outline" disabled={busy} onClick={() => run(async () => { const r = await supabase.rpc('create_client_billing_link', { _id: id }); if (r.error) throw r.error; await navigator.clipboard.writeText(`https://fieldbridgeapp.com/billing-document/${r.data}`); toast.success('30-day document link copied'); })}><Copy className="mr-2 h-4 w-4" />Copy link</Button><Button variant="ghost" disabled={busy} onClick={() => { if (confirm('Revoke all shared links for this document?')) void run(async () => { const r = await supabase.rpc('revoke_client_billing_links', { _id: id }); if (r.error) throw r.error; toast.success('Shared links revoked'); }); }}><ShieldOff className="mr-2 h-4 w-4" />Revoke links</Button></div>;
}