import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { NumInput } from '@/components/num-input';
import { TAX_STATUSES, TAX_LABELS, defaultStatutory, type StatutoryYear, type TaxStatus, type Contribution } from '@/lib/payroll-statutory';

const bandLabel = (bands: StatutoryYear['tax'][TaxStatus], i: number) => {
  const b = bands[i]; if (!b) return '';
  const from = b.from ?? (i === 0 ? 0 : Number(bands[i - 1]?.to));
  return `From €${from.toLocaleString()} to ${b.to === null ? 'no limit' : `€${Number(b.to).toLocaleString()}`} · Rate ${b.rate}% · Subtract €${b.subtract.toLocaleString()}`;
};

export function PayrollRates({ value, onChange, onSave, busy }: { value: StatutoryYear; onChange: (v: StatutoryYear) => void; onSave: () => void; busy: boolean }) {
  const [status, setStatus] = useState<TaxStatus>('single');
  const field = (label: string, k: 'lowWage' | 'olderCap' | 'newerCap' | 'overtimeTaxRate' | 'weeksPerYear') => <div className="space-y-1"><Label>{label}</Label><NumInput aria-label={label} min={0} step="0.01" value={value[k]} onChange={(v) => onChange({ ...value, [k]: v })} /></div>;
  const setBand = (i: number, patch: Partial<StatutoryYear['tax'][TaxStatus][number]>) => onChange({ ...value, tax: { ...value.tax, [status]: value.tax[status].map((row, j) => j === i ? { ...row, ...patch } : row) } });
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-medium">Annual statutory rates</h2>
      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="outline" size="sm"><RotateCcw className="mr-1 h-4 w-4" />Reset to Malta defaults</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Restore standard bands?</AlertDialogTitle><AlertDialogDescription>This replaces the {TAX_LABELS[status]} tax bands with the standard Malta statutory brackets. Your other statuses and SSC rates are not touched.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onChange({ ...value, tax: { ...value.tax, [status]: defaultStatutory().tax[status] } })}>Restore {TAX_LABELS[status]} bands</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">{field('A/B maximum weekly wage (€)', 'lowWage')}{field('Older birth group C maximum (€)', 'olderCap')}{field('Newer birth group C maximum (€)', 'newerCap')}{field('Overtime concession tax (%)', 'overtimeTaxRate')}{field('Weeks per year', 'weeksPerYear')}<div className="space-y-1"><Label>Older birth group cutoff</Label><input type="date" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={value.birthCutoff} onChange={(e) => onChange({ ...value, birthCutoff: e.target.value })} /></div></div>
    <Select value={status} onValueChange={(s) => setStatus(s as TaxStatus)}><SelectTrigger aria-label="Tax table" className="max-w-sm"><SelectValue /></SelectTrigger><SelectContent>{TAX_STATUSES.map((s) => <SelectItem key={s} value={s}>{TAX_LABELS[s]}</SelectItem>)}</SelectContent></Select>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>From (exclusive)</th><th>To (€)</th><th>Rate (%)</th><th>Subtract (€)</th><th /></tr></thead><tbody>{value.tax[status].map((b, i) => <tr key={i} className="border-b">
      <td className="p-1"><NumInput className="min-w-24" aria-label={`${status} band ${i + 1} from`} min={0} step="0.01" value={b.from ?? (i === 0 ? 0 : Number(value.tax[status][i - 1]?.to))} onChange={(v) => setBand(i, { from: v })} /></td>
      <td className="p-1"><NumInput className="min-w-24" aria-label={`${status} band ${i + 1} to`} min={0} step="0.01" placeholder="No limit" value={b.to ?? Number.NaN} onChange={(v) => setBand(i, { to: Number.isFinite(v) && v > 0 ? v : null })} /></td>
      <td className="p-1"><NumInput className="min-w-24" aria-label={`${status} band ${i + 1} rate`} min={0} step="0.01" value={b.rate} onChange={(v) => setBand(i, { rate: v })} /></td>
      <td className="p-1"><NumInput className="min-w-24" aria-label={`${status} band ${i + 1} subtract`} min={0} step="0.01" value={b.subtract} onChange={(v) => setBand(i, { subtract: v })} /></td>
      <td>
        <AlertDialog>
          <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button size="icon" variant="ghost" aria-label={`Remove tax band ${i + 1}`}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>{bandLabel(value.tax[status], i)}</TooltipContent></Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete this tax band?</AlertDialogTitle><AlertDialogDescription>Band {i + 1}: {bandLabel(value.tax[status], i)}. This cannot be undone, but you can restore the standard bands with “Reset to Malta defaults”.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onChange({ ...value, tax: { ...value.tax, [status]: value.tax[status].filter((_, j) => j !== i) } })}>Delete band</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </td>
    </tr>)}</tbody></table></div>
    <Button variant="outline" size="sm" onClick={() => onChange({ ...value, tax: { ...value.tax, [status]: [...value.tax[status], { to: null, rate: 0, subtract: 0 }] } })}><Plus className="mr-1 h-4 w-4" />Add band</Button>
    <h3 className="font-medium">SSC & maternity · per Monday</h3>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>Category</th><th>Contribution</th><th>Rate %</th><th>Fixed €</th><th>Cap €</th></tr></thead><tbody>{Object.entries(value.ssc).flatMap(([cat, s]) => (['employee', 'employer', 'maternity'] as const).map((who) => <tr key={cat + who} className="border-b"><td>{cat.replace('_', ' · ')}</td><td>{who}</td>{(['rate', 'fixed', 'cap'] as const).map((k) => <td key={k} className="p-1"><NumInput className="min-w-24" min={0} step="0.01" aria-label={`${cat} ${who} ${k}`} placeholder={k === 'fixed' ? 'Use rate' : k === 'cap' ? 'Uncapped' : ''} value={s[who][k] ?? Number.NaN} onChange={(v) => { const contribution: Contribution = { ...s[who], [k]: k !== 'rate' && !Number.isFinite(v) ? null : v }; onChange({ ...value, ssc: { ...value.ssc, [cat]: { ...s, [who]: contribution } } }); }} /></td>)}</tr>))}</tbody></table></div>
    <Button disabled={busy} onClick={onSave}>Save annual rates</Button>
  </div>;
}
