import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Snowflake, Store, Croissant, Factory, ParkingSquare, QrCode, Clock, FileText, ChevronDown, Play } from "lucide-react";
import { AisleOpsDemo } from "@/components/aisleops-demo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import hero from "@/assets/retail-hero.jpg";
import { Button } from "@/components/ui/button";
import { EDITION_SPEC } from "@/lib/editions";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPublicCatalog } from "@/lib/public-catalog.functions";
import { RetailValue } from "@/components/retail-value";

const retailCatalogQuery = queryOptions({ queryKey: ["public-catalog", "fieldbridge-retail"], queryFn: () => listPublicCatalog({ data: { product: "fieldbridge-retail" } }), staleTime: 60_000, refetchInterval: 60_000 });

const TITLE = "AisleOps | Supermarket & Store Maintenance Software";
const DESC = "AisleOps supermarket maintenance software: paperless work orders, QR fault reporting and dispatch. Compare team plans and estimate your retail maintenance ROI.";

export const Route = createFileRoute("/retail")({
  staticData: { sitemap: true },
  loader: ({ context }) => context.queryClient.ensureQueryData(retailCatalogQuery),
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "AisleOps", applicationCategory: "BusinessApplication", operatingSystem: "Web", description: DESC, offers: (loaderData?.plans ?? []).map(p => ({ "@type": "Offer", name: p.name, price: p.monthly_price, priceCurrency: "EUR", description: `Monthly company plan with ${p.included_seats} team accounts and fair-use cloud storage.` })) }) }],
  }),
  component: RetailPage,
  errorComponent: () => <div role="alert" className="p-8">AisleOps pricing is temporarily unavailable. Please try again shortly.</div>,
});

type Row = [string, string, "urgent" | "ok" | "info"];
const MOCKS: Record<string, { screen: string; rows: Row[] }> = {
  "Refrigeration & cold chain": { screen: "Cold-chain alerts", rows: [["Freezer island 3 · Mosta", "Urgent", "urgent"], ["Cold room B · Qormi", "Tech en route", "info"], ["Dairy chiller · Sliema", "Fixed 07:42", "ok"]] },
  "In-store bakery & pastry": { screen: "Bakery PPM", rows: [["Deck oven 2 · door seal", "Due today", "urgent"], ["Proofer · humidity check", "Done", "ok"], ["Spiral mixer · belt", "Next week", "info"]] },
  "Food production & packaging": { screen: "Production line", rows: [["Packing line 1", "Running", "ok"], ["Labeller · jam", "Assigned", "info"], ["Downtime this month", "3.2 h", "info"]] },
  "Store fabric & public safety": { screen: "Fabric faults", rows: [["Cracked floor tile · Aisle 7", "Hazard", "urgent"], ["Auto door · entrance", "Repaired", "ok"], ["Washroom light", "Scheduled", "info"]] },
  "Car parks & loading bays": { screen: "Outdoor assets", rows: [["Dock leveller · Bay 2", "Urgent", "urgent"], ["Barrier arm · exit", "Fixed", "ok"], ["Lighting column 14", "Planned", "info"]] },
  "QR code fault reporting": { screen: "Report a problem", rows: [["Store", "Mosta Superstore", "info"], ["Equipment", "Freezer island 3", "info"], ["Photo + note", "Sent ✓", "ok"]] },
  "Technician clock-in / out": { screen: "My shift", rows: [["Clocked in", "06:58", "ok"], ["Location", "Qormi Store", "info"], ["Jobs today", "4", "info"]] },
  "Daily Work Reports (DWR)": { screen: "Daily work report", rows: [["Jobs completed", "5", "ok"], ["Hours · breaks", "8.0 h · 30 min", "info"], ["Supervisor sign-off", "Pending", "urgent"]] },
};
function Mock({ area }: { area: string }) {
  const m = MOCKS[area]; if (!m) return null;
  const tone = { urgent: "bg-destructive/10 text-destructive", ok: "bg-primary/10 text-primary", info: "bg-muted text-muted-foreground" } as const;
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-[260px] rounded-[2rem] border-4 border-foreground/80 bg-background p-3 shadow-xl">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-foreground/20" />
      <div className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">AisleOps · {m.screen}</div>
      <div className="mt-3 space-y-2">{m.rows.map(([a, b, t]) => <div key={a} className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-2 text-[11px]"><span className="font-medium">{a}</span><span className={`shrink-0 rounded px-1.5 py-0.5 font-semibold ${tone[t]}`}>{b}</span></div>)}</div>
      <div className="mt-3 rounded-md bg-brand-amber py-2 text-center text-[11px] font-bold text-foreground">{area === "QR code fault reporting" ? "Submit report" : "Open job"}</div>
    </div>
  );
}

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
  const { data: catalog } = useSuspenseQuery(retailCatalogQuery);
  useEffect(() => { document.documentElement.dataset["edition"] = "retail"; return () => { delete document.documentElement.dataset["edition"]; }; }, []);
  const spec = EDITION_SPEC.retail;
  const [open, setOpen] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="font-display text-xl font-bold uppercase">{spec.product}</p>
          <div className="flex items-center gap-2"><Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><a href="#roi">Savings calculator</a></Button><Button asChild variant="secondary" size="sm"><Link to="/auth">Sign in</Link></Button></div>
        </div>
      </header>
      <section className="relative">
        <img src={hero} alt="Technician checking a supermarket chiller aisle" width={1536} height={1024} className="h-[520px] w-full object-cover" />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-foreground/80 to-transparent">
          <div className="mx-auto w-full max-w-6xl px-6 pb-12 text-background">
            <p className="text-sm font-semibold uppercase tracking-wide opacity-80">AisleOps supermarket maintenance software</p>
            <h1 className="mt-2 max-w-3xl font-display text-4xl font-bold uppercase leading-none sm:text-5xl">Cut Supermarket Downtime &amp; Spoilage Across Every Store.</h1>
            <p className="mt-4 max-w-2xl text-lg opacity-90">The all-in-one maintenance platform built for retail chains. QR fault logging for shop-floor staff, automated cold-chain dispatch, and instant digital work orders (DWR)—without paperwork.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-brand-amber text-foreground hover:bg-brand-amber/90"><a href="mailto:hello@fieldbridgeapp.com?subject=Book%20a%2015-minute%20AisleOps%20demo">Book a 15-Minute Demo</a></Button>
              <Button size="lg" variant="outline" onClick={() => setDemo(true)} className="border-background/60 bg-transparent text-background hover:bg-background/10 hover:text-background"><Play className="mr-2 h-4 w-4" />Try the Interactive Demo (No Sign-In Required)</Button>
            </div>
            <a href="#roi" className="mt-4 inline-block text-sm underline underline-offset-4 opacity-90">See what you could save ↓</a>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px bg-border sm:grid-cols-3">
        {STATS.map(([a, b]) => <div key={a} className="bg-background p-6"><p className="font-display text-3xl font-bold text-primary">{a}</p><p className="text-sm text-muted-foreground">{b}</p></div>)}
      </section>
      <section className="border-b bg-secondary" aria-labelledby="qr-title">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">QR code fault reporting</p>
            <h2 id="qr-title" className="mt-2 font-display text-3xl font-bold sm:text-4xl">Zero apps, zero accounts for shop floor staff — just scan and submit.</h2>
            <p className="mt-4 text-muted-foreground">Print a plaque for every chiller, oven or aisle. Staff scan, describe the fault, add a photo and send — the report lands with the right store and equipment already filled in.</p>
            <Button className="mt-6" onClick={() => setDemo(true)}>Watch a chiller fault get fixed</Button>
          </div>
          <Mock area="QR code fault reporting" />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-3xl font-bold uppercase">Built for the whole estate</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((f) => (
            <div key={f.title} className={`border-l-4 border-primary bg-card transition ${open === f.title ? "sm:col-span-2 lg:col-span-3" : ""}`}>
              <Button type="button" variant="ghost" aria-expanded={open === f.title} onClick={() => setOpen(open === f.title ? null : f.title)} className="block h-auto w-full whitespace-normal rounded-none p-5 text-left">
                <div className="flex items-center justify-between"><f.icon className="h-6 w-6 text-brand-amber" /><ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open === f.title ? "rotate-180" : ""}`} /></div>
                <h3 className="mt-2 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </Button>
              <div className={open === f.title ? "px-5 pb-5" : "hidden"}>
                <div className="grid items-center gap-6 md:grid-cols-2">
                  <div><ul className="list-disc space-y-1 pl-5 text-sm">{f.more.map((m) => <li key={m}>{m}</li>)}</ul>
                  <Button size="sm" variant="outline" className="mt-4" onClick={() => setDemo(true)}>See it in the demo</Button></div>
                  <Mock area={f.title} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">Site types ready to use: {spec.siteTypes.join(" · ")}</p>
      </section>
      <RetailValue catalog={catalog} onDemo={() => setDemo(true)} />
      <Dialog open={demo} onOpenChange={setDemo}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>AisleOps interactive demo</DialogTitle></DialogHeader>
          <AisleOpsDemo />
          <Link to="/demo" className="text-sm text-primary underline">Open the demo on its own page</Link>
        </DialogContent>
      </Dialog>
      <footer className="bg-foreground py-6 text-center text-sm text-background">{spec.product} · powered by FieldBridge · <a href="mailto:sales@fieldbridgeapp.com" className="underline">Contact sales</a></footer>
    </div>
  );
}
