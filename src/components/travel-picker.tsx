import { useState } from 'react';
import { Input } from '@/components/ui/input';
const PRESETS = [0, 15, 30, 45, 60];
/** Travel entered as minute presets; stored as hours. */
export function TravelPicker({ hours, onChange }: { hours: number; onChange: (hours: number) => void }) {
  const minutes = Math.round((Number(hours) || 0) * 60);
  const [custom, setCustom] = useState(!PRESETS.includes(minutes));
  return <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Travel time">
    {PRESETS.map(m => <button key={m} type="button" aria-pressed={!custom && minutes === m} onClick={() => { setCustom(false); onChange(m / 60); }}
      className={`h-11 min-w-11 rounded-md border px-2 text-sm ${!custom && minutes === m ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}>{m}</button>)}
    <button type="button" aria-pressed={custom} onClick={() => setCustom(true)} className={`h-11 rounded-md border px-2 text-sm ${custom ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}>Other</button>
    {custom && <Input type="number" inputMode="numeric" min={0} step={5} aria-label="Travel minutes" className="h-11 w-20" value={minutes} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0) / 60)} />}
    <span className="text-xs text-muted-foreground">min</span>
  </div>;
}
