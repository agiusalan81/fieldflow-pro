import { useState } from 'react';
import { defaultRenewalDates, renewalDatesValid } from '@/lib/renewal-dates';
import { CoverageDatePicker } from '@/components/coverage-date-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
export function CoverageRenewalDialog({ title, expiry, busy, onClose, onSave }: { title: string; expiry: string; busy: boolean; onClose: () => void; onSave: (dates: { start: string; end: string }) => Promise<void> }) {
  const [dates, setDates] = useState(() => defaultRenewalDates(expiry));
  const valid = renewalDatesValid(dates.start, dates.end);
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><CoverageDatePicker label="Renewal start date" value={dates.start} onChange={start => setDates({ ...dates, start })} /><CoverageDatePicker label="Renewal expiry date" value={dates.end} onChange={end => setDates({ ...dates, end })} />{!valid && <p role="alert" className="text-sm text-destructive">Expiry must be after the start date.</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !valid} onClick={() => void onSave(dates)}>{busy ? 'Saving…' : 'Confirm renewal'}</Button></DialogFooter></DialogContent></Dialog>;
}