import { useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { productLink } from '@/lib/platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function HQCompanyInvite({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}><UserPlus className="mr-1 h-4 w-4" />Superuser invite</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Invite initial Superuser</DialogTitle><DialogDescription>{companyName} · Single-use invitation, valid for 14 days.</DialogDescription></DialogHeader>
      <Label htmlFor={`hq-invite-name-${companyId}`}>Name (optional)</Label><Input id={`hq-invite-name-${companyId}`} maxLength={200} value={name} onChange={e => setName(e.target.value)} />
      <Label htmlFor={`hq-invite-email-${companyId}`}>Email (optional)</Label><Input id={`hq-invite-email-${companyId}`} type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
      <Button disabled={busy} onClick={async () => { setBusy(true); try {
        const { data, error } = await supabase.rpc('platform_initial_superuser_invite', { _company: companyId, ...(email.trim() ? { _email: email.trim() } : {}), ...(name.trim() ? { _name: name.trim() } : {}) });
        if (error) throw error;
        if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data['token'] !== 'string' || typeof data['app_url'] !== 'string') throw new Error('Could not generate invitation');
        setLink(productLink(data['app_url'], `/join/${data['token']}`, window.location.origin));
        setExpires(typeof data['expires_at'] === 'string' ? data['expires_at'].slice(0, 10) : '');
        toast.success('Invitation link created');
      } catch (e) { toast.error((e as { message?: string })?.message ?? 'Could not create invitation'); } finally { setBusy(false); } }}>{busy ? 'Creating…' : link ? 'Replace invitation link' : 'Generate invitation link'}</Button>
      {link && <><Label htmlFor={`hq-invite-link-${companyId}`}>Invitation link · expires {expires}</Label><Input id={`hq-invite-link-${companyId}`} readOnly value={link} /><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(link); toast.success('Invitation link copied'); } catch { toast.error('Could not copy. Select the link to copy it.'); } }}><Copy className="mr-2 h-4 w-4" />Copy invite link</Button></>}
    </DialogContent></Dialog></>;
}