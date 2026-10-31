import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTerminology } from '@/lib/company';
import { AssetHistory } from '@/components/job-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from '@tanstack/react-router';
import { QrCamera } from '@/components/qr-camera';
import { scannedTarget } from '@/lib/qr-scan';
export function QrLookup() {
  const word = useTerminology();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ id: string; label: string } | 'none' | null>(null);
  const lookup = async (reference: string, assetId?: string) => {
    if (busy) return;
    setBusy(true); setFound(null);
    try {
      let query = supabase.from('assets').select('id,reference_number,asset_category,clients(name)');
      query = assetId ? query.eq('id', assetId) : query.eq('reference_number', reference.trim());
      const r = await query.limit(2);
      if (r.error) { toast.error('Could not look up this reference'); return; }
      if (r.data.length > 1) { toast.error('More than one item uses this reference. Open the item from your site instead.'); return; }
      const a = r.data[0];
      if (a) setCode(a.reference_number ?? reference);
      setFound(a ? { id: a.id, label: `${a.reference_number} · ${a.asset_category} · ${a.clients?.name ?? ''}` } : 'none');
    } catch { toast.error('Could not look up this reference'); }
    finally { setBusy(false); }
  };
  const scan = async (value: string) => {
    const target = scannedTarget(value, window.location.origin);
    if (!target) { toast.error('This QR code is not a supported equipment or location code.'); return; }
    if (target.kind === 'asset') { await lookup('', target.id); return; }
    if (target.kind === 'reference') { setCode(target.reference); await lookup(target.reference); return; }
    if (target.kind === 'store-report') { void navigate({ to: '/store-report/$token', params: { token: target.token } }); return; }
    // Revocation is checked by the existing public-token resolver, then tenant RLS checks the reference.
    const result = await supabase.rpc('get_equipment_report_target', { _token: target.token });
    const data = result.data;
    if (result.error || !data || typeof data !== 'object' || Array.isArray(data) || typeof data['reference'] !== 'string') {
      toast.error('This equipment QR code is unavailable. Use the printed reference instead.'); return;
    }
    setCode(data['reference']); await lookup(data['reference']);
  };
  return <section className="mx-auto max-w-xl space-y-4">
    <QrCamera onScan={value => { void scan(value).catch(() => toast.error('Could not read this QR code. Try the printed reference.')); }}/>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (code.trim()) void lookup(code); }}>
      <Label htmlFor="qr-reference">{word('equipment')} reference</Label>
      <div className="flex gap-2"><Input id="qr-reference" required value={code} onChange={e => setCode(e.target.value)} placeholder="Reference printed under the QR code"/><Button disabled={busy || !code.trim()}>{busy ? 'Looking up…' : 'Look up'}</Button></div>
    </form>
    {found === 'none' && <p role="status" className="text-sm text-muted-foreground">No item found with that reference.</p>}
    {found && found !== 'none' && <AssetHistory assetId={found.id} label={found.label}/>}
  </section>;
}