import { useState } from "react";
import { ArrowRight, Calculator, Check, Clock, Snowflake, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEur, priceForCadence, cadenceSuffix, type BillingCadence } from "@/lib/catalog-pricing";
import type { PublicCatalog } from "@/lib/public-catalog.functions";
import { retailRoi, type RoiInputs } from "@/lib/retail-roi";
import { RoiLead } from "@/components/roi-lead";

const SALES = "mailto:sales@fieldbridgeapp.com?subject=AisleOps%20trial%20request";
const labels: Record<string, string> = { core: "Work orders, equipment & fixtures, inventory and team chat", tracking: "Clock-in/out and consent-based shift location", receipts: "Expense receipts", skills_dispatch: "Skill-based dispatch, open jobs and claim incentives", ppm_automation: "Recurring maintenance schedules", standby: "On-call rotas and swaps", safety: "Safety checklists", reports: "Maintenance reports", technical_library: "Technical manuals and drawings", fleet_management: "Van routes and fleet records", payroll: "Hours, overtime and gross payroll", branding_basic: "Company logo and colours", branding_documents: "Document styling", branding_advanced: "Advanced branding", custom_app_title: "Custom app title", digitization: "Document scans and digitization" };

export function RetailValue({ catalog, onDemo }: { catalog: PublicCatalog; onDemo: () => void }) {
  const [cadence, setCadence] = useState<BillingCadence>("monthly");
  const [planId, setPlanId] = useState(catalog.plans[1]?.id ?? catalog.plans[0]?.id ?? "");
  const [input, setInput] = useState<RoiInputs>({ stores: 3, technicians: 10, days: 21, minutes: 45, hourlyRate: 28, comparisonPerSeat: null, setupCost: 0 });
  const selected = catalog.plans.find(p => p.id === planId) ?? catalog.plans[0];
  const result = selected ? retailRoi(input, selected, cadence) : null;
  const set = (key: keyof RoiInputs, value: number | null) => setInput(old => ({ ...old, [key]: value }));
  return <>
    <section className="border-y bg-secondary" aria-labelledby="value-title">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-sm font-semibold uppercase text-primary">Retail maintenance. Less administration.</p>
        <h2 id="value-title" className="mt-3 max-w-3xl font-display text-3xl font-bold sm:text-4xl">Put your budget into maintenance, not paperwork.</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <article><Users className="h-7 w-7 text-primary" /><h3 className="mt-4 text-xl font-semibold">One team. A predictable plan.</h3><p className="mt-3 text-muted-foreground">Company plans include a team allowance. No per-seat surprises as your team grows.</p></article>
          <article><Clock className="h-7 w-7 text-primary" /><h3 className="mt-4 text-xl font-semibold">What could 45 minutes give back?</h3><p className="mt-3 text-muted-foreground">A sample team of 10 recovering 45 minutes of paperwork per person on 21 working days gains 157.5 hours a month. Set your own numbers in the calculator below.</p></article>
          <article><Snowflake className="h-7 w-7 text-primary" /><h3 className="mt-4 text-xl font-semibold">Fewer calls between fault and action.</h3><p className="mt-3 text-muted-foreground">Connects the shop floor to on-duty technicians in seconds—eliminating phone tags, lost WhatsApp messages, and delayed repairs.</p><Button variant="link" className="mt-2 px-0" onClick={onDemo}>Follow a chiller fault in the demo <ArrowRight className="ml-2 h-4 w-4" /></Button></article>
        </div>
      </div>
    </section>
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-16" aria-labelledby="pricing-title">
      <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="text-sm font-semibold text-primary">AisleOps plans & packs</p><h2 id="pricing-title" className="mt-2 font-display text-3xl font-bold">From one store to central production.</h2></div><Tabs value={cadence} onValueChange={v => setCadence(v as BillingCadence)}><TabsList aria-label="Billing period"><TabsTrigger value="monthly">Monthly</TabsTrigger><TabsTrigger value="quarterly">Quarterly</TabsTrigger><TabsTrigger value="yearly">Yearly</TabsTrigger></TabsList></Tabs></div>
      {catalog.error || catalog.plans.length === 0 ? <p role="alert" className="mt-8">Pricing is temporarily unavailable. Contact us for a current quote.</p> : <div className="mt-8 grid gap-4 lg:grid-cols-3">{catalog.plans.map(p => <article key={p.id} className="flex flex-col rounded-lg border bg-card p-6"><h3 className="min-h-14 text-xl font-semibold">{p.name}</h3><p className="mt-4 font-display text-4xl font-bold">{formatEur(priceForCadence(p, cadence))}<span className="font-sans text-sm font-normal text-muted-foreground">{cadenceSuffix(cadence)}</span></p><p className="mt-2 text-sm text-muted-foreground">Billed {cadence}. {p.included_seats} team accounts · generous fair-use cloud storage.</p><ul className="my-6 space-y-3 text-sm">{p.modules.map(m => <li key={m} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{labels[m] ?? m.replace(/_/g, " ")}</span></li>)}</ul><Button asChild className="mt-auto"><a href={`${SALES}&body=${encodeURIComponent(`I would like to try ${p.name}.`)}`}>Start 14-Day Free Trial</a></Button></article>)}</div>}
      <p className="mt-5 text-sm text-muted-foreground">No card needed to start. Every plan includes generous fair-use cloud storage. Prefer a guided rollout? <a href={`${SALES}&body=${encodeURIComponent("I would like to book a 30-day pilot.")}`} className="font-semibold text-primary underline">Book a 30-Day Pilot</a>.</p>
      <h3 className="mt-10 text-xl font-semibold">Add specialist packs when you need them.</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{catalog.packs.filter(p => !(p.storage_gb > 0)).map(p => <article key={p.id} className="rounded-lg border p-5"><h4 className="font-semibold">{p.name}</h4><p className="mt-3 text-2xl font-bold">{formatEur(priceForCadence(p, cadence))}<span className="text-sm font-normal text-muted-foreground">{cadenceSuffix(cadence)}</span></p><p className="mt-2 text-sm text-muted-foreground">{p.modules.map(m => labels[m] ?? m.replace(/_/g, " ")).join(" · ")}</p></article>)}</div>
      <p className="mt-5 text-sm text-muted-foreground">Need extra team accounts? Contact us for a tailored seat quote. No automatic additional-seat charge is applied.</p>
    </section>
    <section id="roi" className="border-y bg-secondary" aria-labelledby="roi-title">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-center gap-3 text-primary"><Calculator className="h-6 w-6" /><p className="text-sm font-semibold uppercase">Supermarket maintenance software ROI</p></div>
        <h2 id="roi-title" className="mt-3 font-display text-3xl font-bold sm:text-4xl">What could paperless work orders be worth?</h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">Estimate what automated dispatch, zero paperwork, and faster first-time fixes save your retail network each month.</p>
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <div className="space-y-7">
            <div><Label htmlFor="roi-plan">AisleOps plan</Label><Select value={selected?.id ?? ""} onValueChange={setPlanId}><SelectTrigger id="roi-plan" className="mt-2 w-full"><SelectValue placeholder="Choose a plan" /></SelectTrigger><SelectContent>{catalog.plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {p.included_seats} accounts</SelectItem>)}</SelectContent></Select><p className="mt-2 text-xs text-muted-foreground">Uses the {cadence} billing period selected above.</p></div>
            {([{ key: "stores", label: "Store locations", min: 1, max: 30, step: 1, suffix: "" }, { key: "technicians", label: "Maintenance team accounts", min: 1, max: 50, step: 1, suffix: "" }, { key: "minutes", label: "Paperwork minutes recovered per person / day", min: 0, max: 90, step: 5, suffix: " min" }, { key: "days", label: "Working days per month", min: 1, max: 31, step: 1, suffix: "" }, { key: "hourlyRate", label: "Loaded hourly labour cost", min: 1, max: 80, step: 1, suffix: " €/hr" }] as const).map(f => <div key={f.key}><div className="mb-3 flex items-start justify-between gap-4"><Label htmlFor={`roi-${f.key}`} className="leading-5">{f.label}</Label><span className="shrink-0 font-semibold tabular-nums">{input[f.key]}{f.suffix}</span></div><Slider id={`roi-${f.key}`} aria-label={f.label} min={f.min} max={f.max} step={f.step} value={[input[f.key]]} onValueChange={v => set(f.key, v[0] ?? f.min)} /></div>)}
            <div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="roi-quote">Your alternative quote (€ / seat / month)</Label><Input id="roi-quote" type="number" min="0" step="0.01" placeholder="Optional" className="mt-2" value={input.comparisonPerSeat ?? ""} onChange={e => set("comparisonPerSeat", e.target.value === "" ? null : Number(e.target.value))} /></div><div><Label htmlFor="roi-setup">First-year setup & training cost (€)</Label><Input id="roi-setup" type="number" min="0" step="1" className="mt-2" value={input.setupCost} onChange={e => set("setupCost", Number(e.target.value))} /></div></div>
          </div>
          <div className="border-t-4 border-primary pt-6">
            {!result || !selected ? <p>Live pricing is needed before a return can be estimated.</p> : !result.fits ? <div role="status"><h3 className="text-2xl font-semibold">Your team exceeds this plan’s allowance.</h3><p className="mt-3 text-muted-foreground">Choose a larger plan or request a tailored quote. </p><Button asChild className="mt-6"><a href={SALES}>Request a team quote</a></Button></div> : <div aria-live="polite" aria-atomic="true">
              <p className="text-sm text-muted-foreground">First-year net capacity value</p><p data-testid="roi-net" className="mt-2 break-words font-display text-4xl font-bold text-primary">{formatEur(result.net)}</p><p className="mt-3 text-sm text-muted-foreground">For {input.technicians} people across {input.stores} {input.stores === 1 ? "store" : "stores"}.</p>
              <dl className="mt-6 divide-y border-y text-sm">{[["Monthly hours potentially recovered", `${result.hours.toLocaleString("en-IE", { maximumFractionDigits: 1 })} hours`], ["Annual recovered labour capacity", formatEur(result.annualCapacity)], ["AisleOps annual subscription", formatEur(result.annualCost)], ["Annual licence difference", result.licenceDifference === null ? "Enter your euro quote" : formatEur(result.licenceDifference)], ["First-year setup & training", formatEur(input.setupCost)], ["First-year ROI", result.roi === null ? "—" : `${result.roi.toFixed(0)}%`]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>)}</dl>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">Hours = people × minutes ÷ 60 × working days. Annual capacity = hours × hourly cost × 12. Net value = capacity + alternative licence cost (if entered) − subscription − setup. ROI = net ÷ (subscription + setup). Conservative estimate based strictly on labor capacity recovery. Excludes inventory loss prevention and emergency callout fees.</p>
              <RoiLead input={input} result={result} plan={selected.name} cadence={cadence} />
              <Button asChild size="lg" variant="outline" className="mt-4 w-full"><a href={SALES}>Start 14-Day Free Trial</a></Button>
            </div>}
          </div>
        </div>
      </div>
    </section>
  </>;
}