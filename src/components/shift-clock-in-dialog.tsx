import { useEffect, useState, useRef } from 'react';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { normalizePlate, validPlate, formatPlate } from '@/lib/dwr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { initialVehicleUse, vehicleShiftFields, type VehicleUse, type VehicleSettings } from '@/lib/vehicle-clock-in';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ShiftClockInDialog({ userId, open, onOpenChange, onConfirm, label = 'Clock in' }: {
  userId: string; open: boolean; onOpenChange: (open: boolean) => void;
  onConfirm: (plate: string, use: VehicleUse) => Promise<void>; label?: string;
}) {
  const [plate, setPlate] = useState('');
  const edited = useRef(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<VehicleSettings>({policy:'flexible',work_mode:'mobile'});
  const [settingsReady, setSettingsReady] = useState(false);
  const [use, setUse] = useState<VehicleUse>('driver');
  useEffect(() => {
    if (!open) return;
    let active = true;
    edited.current = false; setPlate(''); setLoading(true);
    setSettingsReady(false);
    void supabase.rpc('my_vehicle_clock_in_settings').then(r=>{if(!active)return;if(r.error||!r.data){toast.error('Could not load clock-in settings. Please reopen clock-in.');return;}const s=r.data as unknown as VehicleSettings;setSettings(s);setUse(initialVehicleUse(s));setSettingsReady(true);});
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
        e.preventDefault(); if (busy || !settingsReady) return;
        setBusy(true);
        try { const fields=vehicleShiftFields(settings.policy,use,plate);await onConfirm(fields.vehicle_reg ?? '',fields.vehicle_use); onOpenChange(false); }
        catch (error) { toast.error(error instanceof Error ? error.message : 'Could not clock in'); }
        finally { setBusy(false); }
      }}>
        {settings.policy !== 'disabled' && <Tabs value={use} onValueChange={v=>setUse(v as VehicleUse)}><TabsList className="grid h-auto w-full grid-cols-3"><TabsTrigger disabled={busy} value="driver">Driving</TabsTrigger><TabsTrigger disabled={busy} value="passenger">Passenger</TabsTrigger><TabsTrigger disabled={busy||settings.policy==='mandatory'} value="on_site">On-site</TabsTrigger></TabsList></Tabs>}
        {use !== 'on_site' && <><label className="block text-sm font-medium" htmlFor="vehicle-plate">Vehicle registration</label>
        <Input id="vehicle-plate" autoFocus disabled={busy} inputMode="text" autoCapitalize="characters" placeholder="ABC 123" value={plate} onChange={e => { edited.current = true; setPlate(e.target.value); }} className="h-12 text-center text-lg" />
        <p className={`text-xs ${plate && !validPlate(plate) ? 'text-destructive' : 'text-muted-foreground'}`}>3 letters and 3 numbers.</p></>}
        {loading && <p role="status" className="text-xs text-muted-foreground">Checking your previous vehicle…</p>}
        <Button type="submit" className="h-12 w-full" disabled={busy || !settingsReady || (use !== 'on_site' && !validPlate(plate))}><Play className="mr-1 h-4 w-4" />{busy ? 'Clocking in…' : label}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}