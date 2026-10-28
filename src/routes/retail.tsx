import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Snowflake, Store, Croissant, Factory, ParkingSquare, QrCode, Clock, FileText, ChevronDown, Play } from "lucide-react";
import { AisleOpsDemo } from "@/components/aisleops-demo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import hero from "@/assets/retail-hero.jpg";
import { Button } from "@/components/ui/button";
import { EDITION_SPEC } from "@/lib/editions";

const TITLE = "AisleOps | Supermarket & Store Maintenance Software";
const DESC = "Maintenance software for supermarket chains: refrigeration, bakeries, factories, store fabric and car parks across every outlet, with QR fault reporting.";

export const Route = createFileRoute("/retail")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RetailPage,
});

const STATS = [["Superstores", "and express outlets on one map"], ["Bakeries", "pastry kitchens and factories"], ["1 scan", "from shop floor to engineer"]] as const;
const AREAS = [
  { icon: Snowflake, title: "Refrigeration & cold chain", text: "Chillers, freezer islands and cold rooms flagged as urgent, so stock isn't lost.",
    more: ["Supermarket refrigeration breakdowns go straight to the top of the queue as cold-chain urgent.", "Track every chiller, freezer island and cold room as an asset with full repair history.", "Temperature and defrost checklists support HACCP records across every outlet."] },
  { icon: Croissant, title: "In-store bakery & pastry", text: "Ovens, proofers and mixers kept running before the morning bake.",
    more: ["Bakery equipment maintenance checklists for deck ovens, rack ovens, proofers and mixers.", "Early-morning faults reach the on-shift technician before production is lost.", "Planned preventive maintenance keeps pastry kitchens compliant."] },
  { icon: Factory, title: "Food production & packaging", text: "Lines, packing machines and planned maintenance for your own factory.",
    more: ["PPM software for food production lines, packing and labelling machines.", "Spare parts stock per site, so engineers know what is on the shelf.", "Downtime history shows which machines cost the most."] },
  { icon: Store, title: "Store fabric & public safety", text: "Broken tiles, walls, doors, shutters, lighting and washrooms — logged and tracked.",
    more: ["Slip and trip hazards logged with photos and closed with proof of repair.", "Damaged floor tiles, shelving, automatic doors and shutters tracked per store.", "A clear audit trail for insurance and health-and-safety checks."] },
  { icon: ParkingSquare, title: "Car parks & loading bays", text: "Barriers, lighting, potholes and dock levellers across every outlet.",
    more: ["Car park lighting, barriers and potholes reported and scheduled.", "Dock levellers and loading-bay doors kept working for deliveries.", "Multi-store maintenance management from one screen."] },
  { icon: QrCode, title: "QR code fault reporting", text: "Store staff scan the code on the equipment and report it in seconds.",
    more: ["No app or login for store staff — scan, describe, add a photo, send.", "The QR code already knows the outlet and the equipment.", "Store managers see the status without phoning maintenance."] },
  { icon: Clock, title: "Technician clock-in / out", text: "Know who is on shift, where, and for how long.",
    more: ["Mobile clock-in and clock-out for in-house maintenance teams.", "Location shared only while clocked in, with staff consent.", "Travel and arrival times recorded on every job."] },
  { icon: FileText, title: "Daily Work Reports (DWR)", text: "Every shift summarised and ready for sign-off.",
    more: ["Daily Work Reports list jobs, hours, breaks and parts used.", "Shift handover notes so the next technician picks up where the last left off.", "Approved hours feed overtime and payroll reports."] },
];

function RetailPage() {
  useEffect(() => { document.documentElement.dataset["edition"] = "retail"; return () => { delete document.documentElement.dataset["edition"]; }; }, []);
  const spec = EDITION_SPEC.retail;
  const [open, setOpen] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="font-display text-xl font-bold uppercase tracking-tight">{spec.product}</p>
          <Button asChild variant="secondary" size="sm"><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>
      <section className="relative">
        <img src={hero} alt="Technician checking a supermarket chiller aisle" width={1536} height={1024} className="h-[520px] w-full object-cover" />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-foreground/80 to-transparent">
          <div className="mx-auto w-full max-w-6xl px-6 pb-12 text-background">
            <h1 className="max-w-2xl font-display text-4xl font-bold uppercase leading-none sm:text-6xl">Every store. Every fridge. Every tile.</h1>
            <p className="mt-4 max-w-xl text-lg opacity-90">One maintenance system for your supermarket chain — outlets, bakeries, factories and car parks.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setDemo(true)} className="bg-brand-amber text-foreground hover:bg-brand-amber/90"><Play className="mr-2 h-4 w-4" />Try the interactive demo</Button>
              <Button asChild size="lg" variant="secondary"><a href="mailto:hello@fieldbridgeapp.com?subject=AisleOps%20demo">Book a call</a></Button>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px bg-border sm:grid-cols-3">
        {STATS.map(([a, b]) => <div key={a} className="bg-background p-6"><p className="font-display text-3xl font-bold text-primary">{a}</p><p className="text-sm text-muted-foreground">{b}</p></div>)}
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-3xl font-bold uppercase">Built for the whole estate</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((f) => (
            <div key={f.title} className={`border-l-4 border-primary bg-card transition ${open === f.title ? "sm:col-span-2 lg:col-span-3" : ""}`}>
              <button type="button" aria-expanded={open === f.title} onClick={() => setOpen(open === f.title ? null : f.title)} className="w-full p-5 text-left">
                <div className="flex items-center justify-between"><f.icon className="h-6 w-6 text-brand-amber" /><ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open === f.title ? "rotate-180" : ""}`} /></div>
                <h3 className="mt-2 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </button>
              <div className={open === f.title ? "px-5 pb-5" : "hidden"}>
                <ul className="list-disc space-y-1 pl-5 text-sm">{f.more.map((m) => <li key={m}>{m}</li>)}</ul>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => setDemo(true)}>See it in the demo</Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">Site types ready to use: {spec.siteTypes.join(" · ")}</p>
      </section>
      <Dialog open={demo} onOpenChange={setDemo}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>AisleOps interactive demo</DialogTitle></DialogHeader>
          <AisleOpsDemo />
          <Link to="/demo" className="text-sm text-primary underline">Open the demo on its own page</Link>
        </DialogContent>
      </Dialog>
      <footer className="bg-foreground py-6 text-center text-sm text-background">{spec.product} · powered by FieldBridge</footer>
    </div>
  );
}
