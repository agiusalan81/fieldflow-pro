import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { setViewAs } from '@/lib/profile';
import { clearUserPreview } from '@/lib/impersonation';
import { TEST_RETURN_KEY, canSignOutAfterShiftCheck, isLoadedTestSession } from '@/lib/shift-session';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ShiftSignOut({ userId, onClockOut }: { userId: string | undefined; onClockOut: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const signOut = async () => {
    if (busy || !userId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from('shifts').select('id').eq('user_id', userId)
        .in('shift_type', ['shift', 'standby']).is('ended_at', null).limit(1);
      if (error) throw new Error('Cannot check your shift right now. You are still signed in. Try again when connected.');
      if (!canSignOutAfterShiftCheck(data ? data.length > 0 : undefined)) {
        setTesting(isLoadedTestSession(userId, sessionStorage.getItem(TEST_RETURN_KEY)));
        setOpen(true);
        return;
      }
      await qc.cancelQueries();
      qc.clear();
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      sessionStorage.removeItem(TEST_RETURN_KEY);
      clearUserPreview();
      setViewAs(null);
      await navigate({ to: '/auth', replace: true });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not sign out. Try again.'); }
    finally { setBusy(false); }
  };
  return <>
    <Button variant="ghost" size="sm" className="mt-2 -ml-2" disabled={busy || !userId} onClick={signOut}>
      <LogOut className="mr-2 h-4 w-4" />{busy ? 'Checking shift…' : 'Sign out'}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Clock out before signing out</DialogTitle>
          <DialogDescription>You have an active shift. Complete your clock-out first; you will stay signed in until then.{testing ? ' To continue testing or return without ending this test shift, use Return to Superuser.' : ''}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Stay signed in</Button>
          <Button onClick={async () => { setOpen(false); onClockOut(); setViewAs(null); await navigate({ to: '/dashboard', hash: 'shift-tracker' }); }}><Clock className="mr-2 h-4 w-4" />Go to clock-out</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}