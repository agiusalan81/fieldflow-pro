import { Bold, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PLAQUE_FONT_OPTIONS, type PlaqueMessage } from "@/lib/store-plaque";

export function PlaqueMessageEditor({ label, value, onChange, maxLength }: { label: string; value: PlaqueMessage; onChange: (v: PlaqueMessage) => void; maxLength: number }) {
  return <div className="space-y-2">
    <Label htmlFor={`plaque-${label}`}>{label}</Label>
    <Textarea id={`plaque-${label}`} rows={2} maxLength={maxLength} value={value.text} onChange={e => onChange({ ...value, text: e.target.value })} />
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect className="min-w-0 flex-1 basis-40" aria-label={`${label} font`} value={value.font} onValueChange={font => onChange({ ...value, font })}>{PLAQUE_FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</NativeSelect>
      <Input type="color" aria-label={`${label} colour`} title={`${label} colour`} className="h-10 w-12 p-1" value={value.color || "#111111"} onChange={e => onChange({ ...value, color: e.target.value })} />
      <Button size="icon" variant={value.bold ? "default" : "outline"} aria-label={`${label} bold`} title="Bold" aria-pressed={value.bold} onClick={() => onChange({ ...value, bold: !value.bold })}><Bold className="h-4 w-4" /></Button>
      <Button size="icon" variant={value.underline ? "default" : "outline"} aria-label={`${label} underline`} title="Underline" aria-pressed={value.underline} onClick={() => onChange({ ...value, underline: !value.underline })}><Underline className="h-4 w-4" /></Button>
    </div>
  </div>;
}