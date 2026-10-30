import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { FlaskConical, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { listTestMembers, startTestSession } from '@/lib/test-session.functions';
import { useProfile, setViewAs, ROLE_LABEL } from '@/lib/profile';
import { clearUserPreview } from '@/lib/impersonation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchSelect } from '@/components/search-select';
import { TEST_RETURN_KEY } from '@/lib/shift-session';

const KEY = TEST_RETURN_KEY;
export const clearTestReturnSession = () => sessionStorage.removeItem(KEY);
type ReturnSession = { access_token: string; refresh_token: string; targetId: string; name: string };

export function TestSessionSwitch() {
  const { data: actor } = useProfile();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useServerFn(listTestMembers);
  const start = useServerFn(startTestSession);
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ['test-session-members', actor?.id], enabled: actor?.real_role === 'superuser', queryFn: () => list() });
  if (actor?.real_role !== 'superuser' || !members.data?.available) return null;
  const enter = async () => {
    if (busy || !target) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== actor.id) throw new Error('Sign in again first');
      if (sessionStorage.getItem(KEY)) throw new Error('Return to Superuser before starting another test');
      const member = members.data.members.find(m => m.id === target);
      if (!member) throw new Error('Choose a test account');
      const res = await start({ data: { memberId: target } });
      sessionStorage.setItem(KEY, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, targetId: target, name: member.name } satisfies ReturnSession));
      await qc.cancelQueries();
      const switched = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: 'magiclink' });
      if (switched.error) { clearTestReturnSession(); throw new Error('Could not sign into the test account'); }
      clearUserPreview(); setViewAs(null); qc.clear();
      window.location.assign('/dashboard');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not start testing'); setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><FlaskConical className="mr-1 h-4 w-4"/>Test account</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Test as a team member</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">This signs you into a real test account. Jobs, time logs and other changes will be saved under that account.</p>
      <SearchSelect value={target} onChange={setTarget} placeholder="Choose test account" options={members.data.members.map(m => ({ value: m.id, label: m.name, hint: ROLE_LABEL[m.role] }))}/>
      {!members.data.members.length && <p className="text-sm text-muted-foreground">Invite an active team member to this test company first.</p>}
      <Button disabled={!target || busy} onClick={enter}>{busy ? 'Switching…' : 'Start testing'}</Button>
    </DialogContent>
  </Dialog>;
}

export function ReturnToSuperuserBanner() {
  const { data: actor } = useProfile();
  const qc = useQueryClient();
  const [saved, setSaved] = useState<ReturnSession | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); if (value?.targetId && value?.refresh_token) setSaved(value); } catch { clearTestReturnSession(); } }, []);
  if (!saved || actor?.id !== saved.targetId) return null;
  return <div role="status" className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b bg-warning/15 px-4 py-2 text-sm text-foreground">
    <span>Testing as {saved.name} · changes are saved</span>
    <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        await qc.cancelQueries();
        const restored = await supabase.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
        if (restored.error) throw new Error('Your return session expired. Sign in as Superuser again.');
        clearTestReturnSession(); clearUserPreview(); setViewAs(null); qc.clear();
        window.location.assign('/dashboard');
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not return'); setBusy(false); }
    }}><Undo2 className="mr-1 h-4 w-4"/>{busy ? 'Returning…' : 'Return to Superuser'}</Button>
  </div>;
}