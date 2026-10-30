import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTerminology } from '@/lib/company';
import { AssetHistory } from '@/components/job-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function QrLookup() {
  const word = useTerminology();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ id: string; label: string } | 'none' | null>(null);
  return <section className="mx-auto max-w-xl space-y-4">
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); if (busy || !code.trim()) return; setBusy(true); setFound(null);
      const r = await supabase.from('assets').select('id,reference_number,asset_category,clients(name)').eq('reference_number', code.trim()).limit(2);
      setBusy(false);
      if (r.error) { toast.error('Could not look up this reference'); return; }
      if (r.data.length > 1) { toast.error('More than one item uses this reference. Open the item from your site instead.'); return; }
      const a = r.data[0]; setFound(a ? { id: a.id, label: `${a.reference_number} · ${a.asset_category} · ${a.clients?.name ?? ''}` } : 'none');
    }}>
      <Label htmlFor="qr-reference">{word('equipment')} reference</Label>
      <div className="flex gap-2"><Input id="qr-reference" required value={code} onChange={e => setCode(e.target.value)} placeholder="Reference printed under the QR code"/><Button disabled={busy || !code.trim()}>{busy ? 'Looking up…' : 'Look up'}</Button></div>
    </form>
    {found === 'none' && <p role="status" className="text-sm text-muted-foreground">No item found with that reference.</p>}
    {found && found !== 'none' && <AssetHistory assetId={found.id} label={found.label}/>}
  </section>;
}