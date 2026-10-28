import { useEffect, useState } from 'react';
import { LogIn, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { openTestCompany } from '@/lib/test-company-switch.functions';
import { Button } from '@/components/ui/button';

const KEY = 'fb-hq-return-session';

export function OpenTestCompanyButton({ companyId }: { companyId: string }) {
  const [busy, setBusy] = useState(false);
  return <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in again first');
      const res = await openTestCompany({ data: { companyId } });
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
      const { error } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: 'magiclink' });
      if (error) { localStorage.removeItem(KEY); throw error; }
      toast.success(`Opened ${res.name}`);
      window.location.assign('/dashboard');
    } catch (e) { toast.error((e as Error).message ?? 'Could not open test company'); setBusy(false); }
  }}><LogIn className="mr-1 h-4 w-4" />{busy ? 'Opening…' : 'Open as test'}</Button>;
}

export function ReturnToHqBanner() {
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(!!localStorage.getItem(KEY)); }, []);
  if (!saved) return null;
  return <div className="flex items-center justify-between gap-2 border-b bg-accent px-4 py-2 text-sm text-accent-foreground">
    <span>You are inside a test company as its test Superuser.</span>
    <Button size="sm" variant="outline" onClick={async () => {
      try {
        const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
        const { error } = await supabase.auth.setSession(s);
        localStorage.removeItem(KEY);
        if (error) { await supabase.auth.signOut(); window.location.assign('/auth'); return; }
        window.location.assign('/platform');
      } catch { localStorage.removeItem(KEY); window.location.assign('/auth'); }
    }}><Undo2 className="mr-1 h-4 w-4" />Return to HQ</Button>
  </div>;
}
