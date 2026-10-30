import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEdition } from '@/lib/plan-features';
import { editionAssetLabel, editionEquipmentTypes } from '@/lib/editions';
import { dispatchEquipmentAtSite } from '@/lib/dispatch-equipment';
import { SearchSelect } from '@/components/search-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Asset = { id: string; client_id: string; site_id: string | null; reference_number: string; asset_category: string };
export function DispatchEquipmentSelect({ assets, companyId, clientId, siteId, value, onChange, disabled }: {
  assets: Asset[]; companyId: string; clientId: string; siteId: string | null; value: string; onChange: (id: string) => void; disabled: boolean;
}) {
  const { edition } = useEdition();
  const label = editionAssetLabel(edition);
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('');
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const choices = dispatchEquipmentAtSite(assets, clientId, siteId);
  const types = [...new Set([...editionEquipmentTypes(edition, ['Passenger Lift', 'Goods Lift', 'Platform Lift', 'Escalator', 'Dumbwaiter', 'HVAC', 'Generator', 'Other']), ...choices.map(a => a.asset_category)])];
  const save = async () => {
    if (busy || !reference.trim() || !category.trim()) return;
    setBusy(true);
    try {
      const result = await supabase.from('assets').insert({ company_id: companyId, client_id: clientId, site_id: siteId, reference_number: reference.trim(), asset_category: category.trim(), serial_number: serial.trim() || null }).select('id').single();
      if (result.error) throw result.error;
      await Promise.all(['assets-all', 'assets', 'client-assets', 'entities-unified'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      onChange(result.data.id); setAdding(false);
      toast.success(`${label} added`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not add the item'); }
    finally { setBusy(false); }
  };
  return <>
    <SearchSelect value={value} disabled={disabled || !clientId} placeholder={label} onChange={onChange}
      options={[{ value: 'none', label: `No ${label.toLowerCase()}` }, ...choices.map(a => ({ value: a.id, label: `${a.reference_number} · ${a.asset_category}` }))]}
      createLabel={`Add ${label.toLowerCase()}`} onCreate={typed => { if (disabled) return; setReference(typed); setCategory(''); setSerial(''); setAdding(true); }}/>
    <Dialog open={adding} onOpenChange={open => { if (!busy) setAdding(open); }}>
      <DialogContent><DialogHeader><DialogTitle>Add {label.toLowerCase()}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="dispatch-item-reference">Reference *</Label><Input id="dispatch-item-reference" maxLength={150} value={reference} onChange={e => setReference(e.target.value)}/></div>
          <div className="space-y-1"><Label>Type *</Label><SearchSelect value={category} placeholder="Choose or add type" options={[...new Set([...types, ...(category ? [category] : [])])].map(type => ({ value: type, label: type }))} onChange={setCategory} onCreate={typed => { if (typed) setCategory(typed); }} createLabel="Use type"/></div>
          <div className="space-y-1"><Label htmlFor="dispatch-item-serial">Serial number</Label><Input id="dispatch-item-serial" maxLength={150} value={serial} onChange={e => setSerial(e.target.value)}/></div>
          <Button type="button" disabled={busy || !reference.trim() || !category.trim()} onClick={save}>{busy ? 'Saving…' : 'Save & select'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}