import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Snowflake, Store, Croissant, Factory, ParkingSquare, QrCode } from "lucide-react";
import hero from "@/assets/retail-hero.jpg";
import { Button } from "@/components/ui/button";
import { EDITION_SPEC } from "@/lib/editions";

const TITLE = "FieldBridge Retail | Supermarket & Store Maintenance Software";
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
  { icon: Snowflake, title: "Refrigeration first", text: "Chillers, freezer islands and cold rooms flagged as urgent, so stock isn't lost." },
  { icon: Croissant, title: "Bakery & pastry", text: "Ovens, proofers and mixers kept running before the morning bake." },
  { icon: Factory, title: "Production sites", text: "Lines, packing machines and planned maintenance for your own factory." },
  { icon: Store, title: "Store fabric", text: "Broken tiles, walls, doors, shutters, lighting and washrooms — logged and tracked." },
  { icon: ParkingSquare, title: "Car parks & loading bays", text: "Barriers, lighting, potholes and dock levellers across every outlet." },
  { icon: QrCode, title: "QR fault reporting", text: "Store staff scan the code on the equipment and report it in seconds." },
];

function RetailPage() {
  useEffect(() => { document.documentElement.dataset["edition"] = "retail"; return () => { delete document.documentElement.dataset["edition"]; }; }, []);
  const spec = EDITION_SPEC.retail;
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
            <Button asChild size="lg" className="mt-6 bg-brand-amber text-foreground hover:bg-brand-amber/90"><a href="mailto:hello@fieldbridgeapp.com?subject=FieldBridge%20Retail%20demo">Get a demo</a></Button>
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
            <div key={f.title} className="border-l-4 border-primary bg-card p-5">
              <f.icon className="h-6 w-6 text-brand-amber" />
              <h3 className="mt-2 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">Site types ready to use: {spec.siteTypes.join(" · ")}</p>
      </section>
      <footer className="bg-foreground py-6 text-center text-sm text-background">{spec.product} · powered by FieldBridge</footer>
    </div>
  );
}
