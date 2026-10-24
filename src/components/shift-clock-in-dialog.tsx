import { useEffect, useState, useRef } from 'react';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { normalizePlate, validPlate, formatPlate } from '@/lib/dwr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ShiftClockInDialog({ userId, open, onOpenChange, onConfirm, label = 'Clock in' }: {
  userId: string; open: boolean; onOpenChange: (open: boolean) => void;
  onConfirm: (plate: string) => Promise<void>; label?: string;
}) {
  const [plate, setPlate] = useState('');
  const edited = useRef(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    edited.current = false; setPlate(''); setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.from('shifts').select('vehicle_reg').eq('user_id', userId).eq('shift_type', 'shift').not('vehicle_reg', 'is', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
        if (active) { if (error) toast.error(error.message); else if (!edited.current) setPlate(formatPlate(data?.vehicle_reg ?? '')); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [open, userId]);
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent><DialogHeader><DialogTitle>Shift clock-in</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={async e => {
        e.preventDefault(); if (busy || !validPlate(plate)) return;
        setBusy(true);
        try { await onConfirm(normalizePlate(plate)); onOpenChange(false); }
        catch (error) { toast.error(error instanceof Error ? error.message : 'Could not clock in'); }
        finally { setBusy(false); }
      }}>
        <label className="block text-sm font-medium" htmlFor="vehicle-plate">Vehicle registration</label>
        <Input id="vehicle-plate" autoFocus disabled={busy} inputMode="text" autoCapitalize="characters" placeholder="ABC 123" value={plate} onChange={e => { edited.current = true; setPlate(e.target.value); }} className="h-12 text-center text-lg" />
        <p className={`text-xs ${plate && !validPlate(plate) ? 'text-destructive' : 'text-muted-foreground'}`}>3 letters and 3 numbers. Filled in from your last shift — change it if you're in a different vehicle.</p>
        {loading && <p role="status" className="text-xs text-muted-foreground">Checking your previous vehicle…</p>}
        <Button type="submit" className="h-12 w-full" disabled={busy || !validPlate(plate)}><Play className="mr-1 h-4 w-4" />{busy ? 'Clocking in…' : label}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}