import { DEFAULT_LIFT_PRICING, commercialPriceLines, commercialTotal, type Commercial, type LiftPricing } from "@/lib/document-blocks";
import { NumInput } from "@/components/num-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function LiftCommercialEditor({ value, onChange, alwaysOn = false }: { value: Commercial; onChange: (value: Commercial) => void; alwaysOn?: boolean }) {
  const p = value.liftPricing;
  const fields: { key: Exclude<keyof LiftPricing, "carAccess">; label: string; count?: boolean }[] = [
    { key: "stops", label: "Stops / travel floors", count: true },
    { key: "includedStops", label: "Stops included in base", count: true },
    { key: "extraStopRate", label: "Price per additional stop (€)" },
    { key: "landingDoors", label: "Landing doors", count: true },
    { key: "includedLandingDoors", label: "Landing doors included in base", count: true },
    { key: "landingDoorRate", label: "Price per additional landing door (€)" },
    { key: "extraCarDoorRate", label: "Price per extra cabin door (€)" },
  ];
  return <div className="space-y-3 border-t pt-3">
    {alwaysOn ? <p className="text-sm font-medium">Lift component pricing — stops, landing doors & car access</p> : <label className="flex items-center justify-between gap-2 text-sm font-medium">Lift component pricing<Switch aria-label="Lift component pricing" checked={p !== null} onCheckedChange={enabled => onChange({ ...value, liftPricing: enabled ? { ...DEFAULT_LIFT_PRICING } : null })} /></label>}
    {p && <>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(field => <div key={field.key} className="min-w-0 space-y-1"><Label htmlFor={`lift-${field.key}`}>{field.label}</Label><NumInput id={`lift-${field.key}`} min={0} step={field.count ? 1 : "0.01"} value={p[field.key]} onChange={n => onChange({ ...value, liftPricing: { ...p, [field.key]: Math.max(0, field.count ? Math.floor(n) : n) } })} /></div>)}
        <div className="space-y-1"><Label htmlFor="lift-car-access">Car access</Label><Select value={String(p.carAccess)} onValueChange={v => onChange({ ...value, liftPricing: { ...p, carAccess: v === "3" ? 3 : v === "2" ? 2 : 1 } })}><SelectTrigger id="lift-car-access"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{n} car access</SelectItem>)}</SelectContent></Select></div>
      </div>
      <p className="text-sm text-muted-foreground">{p.carAccess} car access · {p.carAccess - 1} extra cabin {p.carAccess === 2 ? "door" : "doors"}</p>
      <div role="group" aria-label="Client price display" className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={value.clientPriceDisplay === "compound" ? "default" : "outline"} onClick={() => onChange({ ...value, clientPriceDisplay: "compound" })}>Compound total</Button><Button type="button" size="sm" variant={value.clientPriceDisplay === "itemised" ? "default" : "outline"} onClick={() => onChange({ ...value, clientPriceDisplay: "itemised" })}>Itemised prices</Button></div>
      <label className="flex items-center justify-between gap-2 text-sm">Base rates & sample calculation on client copy<Switch aria-label="Sample calculation on client copy" checked={value.showSampleCalculation} onCheckedChange={showSampleCalculation => onChange({ ...value, showSampleCalculation })} /></label>
      <p className="font-semibold">Calculated price: €{commercialTotal(value)?.toFixed(2)}</p>
    </>}
  </div>;
}

export function CommercialPriceSummary({ value, cycle }: { value: Commercial; cycle?: string | undefined }) {
  const total = commercialTotal(value);
  if (total === null) return null;
  const p = value.liftPricing;
  return <div className="space-y-2">
    {p && <p>{p.stops} stops · {p.landingDoors} landing doors · {p.carAccess} car access</p>}
    {p && value.clientPriceDisplay === "itemised" && <dl className="space-y-1">{commercialPriceLines(value).filter(line => line.key === "base" || line.quantity > 0).map(line => <div key={line.key} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b pb-1"><dt className="min-w-0 flex-1">{line.label}{line.key !== "base" && <span className="block text-[11px] opacity-80">{line.quantity} × €{line.rate.toFixed(2)}</span>}</dt><dd className="shrink-0">€{line.amount.toFixed(2)}</dd></div>)}</dl>}
    {p && value.showSampleCalculation && <section className="space-y-1 border-t pt-2"><h4 className="font-semibold">Base rates & sample calculation</h4><p>Base price: €{(value.basePrice ?? 0).toFixed(2)} · includes {p.includedStops} stops, {p.includedLandingDoors} landing doors and 1 car access</p><p>Additional stop: €{p.extraStopRate.toFixed(2)} · Additional landing door: €{p.landingDoorRate.toFixed(2)} · Extra cabin door: €{p.extraCarDoorRate.toFixed(2)}</p><p>{commercialPriceLines(value).map(line => `${line.quantity} × €${line.rate.toFixed(2)}`).join(" + ")} = €{total.toFixed(2)}</p></section>}
    <p className="font-semibold">{p ? "Total: " : ""}€{total.toFixed(2)} {cycle}</p>
  </div>;
}