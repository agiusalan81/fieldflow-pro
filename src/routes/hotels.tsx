import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { BedDouble, QrCode, Wrench, CalendarClock, ShieldCheck, Sparkles } from "lucide-react";
import hero from "@/assets/hotels-hero.jpg";
import logo from "@/assets/hotels-logo.png";
import { Button } from "@/components/ui/button";
import { EDITION_SPEC } from "@/lib/editions";

const TITLE = "FieldBridge Hotels | Hotel Maintenance & Room Defect Software";
const DESC = "In-house hotel engineering software: guest-room QR fault reporting, work orders, preventive maintenance and team rotas for hotels and resorts.";

export const Route = createFileRoute("/hotels")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HotelsPage,
});

const FEATURES = [
  { icon: QrCode, title: "Room QR reporting", text: "Guests and housekeeping scan the code in the room and report a fault with a photo. No app, no login." },
  { icon: Wrench, title: "Work orders to the right engineer", text: "Electrical, HVAC, plumbing or general — jobs go to whoever has the skill and is on shift." },
  { icon: BedDouble, title: "Out-of-order rooms, back sooner", text: "See which rooms are blocked and why, so front office can sell them again the same day." },
  { icon: CalendarClock, title: "Planned maintenance & rotas", text: "Chillers, pools, kitchens and fire systems on schedule, with on-call cover for nights." },
  { icon: ShieldCheck, title: "Audit-ready history", text: "Every fix, part and photo kept against the room or asset for inspections and owners." },
  { icon: Sparkles, title: "Your hotel's own branding", text: "Logo, colours and documents in your group's style." },
];

function HotelsPage() {
  useEffect(() => { document.documentElement.dataset["edition"] = "hotel"; return () => { delete document.documentElement.dataset["edition"]; }; }, []);
  const spec = EDITION_SPEC.hotel;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <img src={logo} alt={spec.product} className="h-10 w-auto sm:h-12" />
        <Button asChild variant="outline" className="rounded-full"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-6 lg:grid-cols-2">
        <div>
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-brand-amber">In-house hotel engineering</p>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">Never check a guest into a broken room.</h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">Room defects, work orders, planned maintenance and engineering rotas for hotels and resorts — on one phone app your team will actually use.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full"><a href="mailto:hello@fieldbridgeapp.com?subject=FieldBridge%20Hotels%20demo">Book a demo</a></Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full"><Link to="/auth">Team sign in</Link></Button>
          </div>
        </div>
        <img src={hero} alt="Hotel engineer servicing a guest-room air conditioner" width={1536} height={1024} className="aspect-[4/3] w-full rounded-[2rem] object-cover shadow-xl" />
      </section>
      <section className="bg-sidebar py-16 text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl">Built around rooms, not contracts</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <f.icon className="h-7 w-7 text-brand-amber" />
                <h3 className="mt-3 font-display text-xl">{f.title}</h3>
                <p className="mt-2 text-sm opacity-80">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-3xl">Everything in a hotel that can break</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {spec.assetGroups.map((g) => (
            <div key={g.group} className="rounded-2xl border bg-card p-5">
              <p className="font-display text-lg text-primary">{g.group}</p>
              <p className="mt-2 text-sm text-muted-foreground">{g.items.join(" · ")}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">{spec.product} · powered by FieldBridge</footer>
    </div>
  );
}
