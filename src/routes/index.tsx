import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Check, ClipboardCheck, FileSignature, MapPin, QrCode, ShieldCheck, Smartphone, Users, Wallet, WifiOff } from "lucide-react";
import fieldbridgeMark from "@/assets/fieldbridge-mark.png";
import hero from "@/assets/landing-hero.jpg";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FieldBridge — Field service software for lift & building-services teams" },
      { name: "description", content: "Job sheets, client signatures, dispatch, fleet GPS, payroll and compliance in one app. Start a 60-day free trial — no card needed." },
      { property: "og:title", content: "FieldBridge — Bridge the field and the office" },
      { property: "og:description", content: "Signed job sheets, smart dispatch, live tracking and payroll for lift and building-services contractors. 60-day free trial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const SIGNUP = "/auth?mode=signup";

const features = [
  { icon: ClipboardCheck, title: "Signed job sheets", body: "Technicians fill, photograph and get client signatures on site. A branded PDF reaches the client the moment the job closes." },
  { icon: Users, title: "Smart dispatch", body: "Open jobs matched to crew skills. The first free technician claims it — or assign a crew of up to 30." },
  { icon: MapPin, title: "Live map & fleet", body: "See who is on the way, live ETAs and past routes — only while staff are clocked in." },
  { icon: Wallet, title: "Payroll-ready hours", body: "Daily work reports flow into overtime, standby and Malta-compliant payslips." },
  { icon: QrCode, title: "Equipment QR codes", body: "Stick a code on every lift. Scan for history, manuals, or let the public report a fault." },
  { icon: WifiOff, title: "Works offline", body: "Lift shafts have no signal. Everything saves on the phone and syncs when you’re back." },
];

const plans = [
  { name: "Basic", price: 89, users: 3, gb: 10, points: ["Job sheets & signatures", "Clients, sites & equipment", "Leave & daily work reports"] },
  { name: "Plus", price: 149, users: 5, gb: 25, points: ["Everything in Basic", "Your own app title & branding", "Contracts & renewals"] },
  { name: "Pro", price: 249, users: 10, gb: 100, featured: true, points: ["Everything in Plus", "Estimates & quantity surveying", "Fleet GPS & technical library"] },
  { name: "Enterprise", price: 399, users: 20, gb: 250, points: ["Every module included", "Smart dispatch & payroll", "Priority onboarding"] },
];

const faqs: [string, string][] = [
  ["Do I need a card for the trial?", "No. Create your company, invite your team and use FieldBridge free for 60 days. We only discuss a plan when you’re ready."],
  ["Is it only for lifts?", "Lifts and escalators come first, but HVAC, electrical, CCTV and other trades can rename fields, checklists and job types to suit."],
  ["Is our data kept separate?", "Yes. Every company has its own isolated workspace, with role-based access for superusers, office admins, supervisors and technicians."],
  ["What happens after the trial?", "Pick a plan monthly, quarterly (10% off) or yearly (20% off). Your records always stay viewable and exportable."],
];

function Landing() {
  return (
    <div className="min-h-screen bg-brand-ink text-brand-navy-deep">
      <header className="sticky top-0 z-30 border-b border-brand-navy/10 bg-brand-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="#top" className="flex items-center gap-2">
            <img src={fieldbridgeMark} alt="" width={36} height={36} className="h-9 w-9" />
            <span className="font-display text-xl font-semibold">FieldBridge</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm md:flex">
            <a href="#features" className="hover:text-brand-amber">Features</a>
            <a href="#how" className="hover:text-brand-amber">How it works</a>
            <a href="#pricing" className="hover:text-brand-amber">Pricing</a>
            <a href="#faq" className="hover:text-brand-amber">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="rounded-md px-3 py-2 text-sm font-medium hover:text-brand-amber">Sign in</Link>
            <a href={SIGNUP} className="rounded-md bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-deep shadow-sm hover:brightness-105">Start free</a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Launch hero */}
        <section className="relative overflow-hidden bg-brand-navy-deep text-brand-ink">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-amber/40 px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand-amber">Launch offer · 60 days free</span>
              <h1 className="mt-5 font-display text-4xl leading-[1.05] md:text-6xl">From the lift shaft to the invoice — <em className="text-brand-amber">one bridge.</em></h1>
              <p className="mt-5 max-w-lg text-lg text-brand-ink/75">FieldBridge replaces paper job sheets, WhatsApp chaos and spreadsheet payroll for lift and building-services contractors.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={SIGNUP} className="inline-flex items-center gap-2 rounded-md bg-brand-amber px-6 py-3 font-semibold text-brand-navy-deep hover:brightness-105">Start your free trial <ArrowRight className="h-4 w-4" /></a>
                <a href="#pricing" className="rounded-md border border-brand-ink/25 px-6 py-3 font-medium hover:border-brand-amber">See pricing</a>
              </div>
              <p className="mt-4 text-sm text-brand-ink/60">No card required · Set up in 10 minutes · Cancel anytime</p>
            </div>
            <div className="relative">
              <img src={hero} alt="Lift engineer using FieldBridge on a tablet in a machine room" width={1200} height={896} className="aspect-[4/3] w-full rounded-xl object-cover shadow-2xl" />
              <div className="absolute -bottom-5 left-5 rounded-lg bg-brand-ink p-4 text-brand-navy-deep shadow-xl">
                <p className="text-xs uppercase tracking-wide text-brand-navy/60">Job sheet #1042</p>
                <p className="flex items-center gap-2 font-semibold"><FileSignature className="h-4 w-4 text-brand-amber" /> Signed & emailed to client</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pain hook */}
        <section className="border-b border-brand-navy/10">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 text-center sm:grid-cols-3">
            {[["Zero", "lost paper job sheets"], ["Same day", "signed reports to clients"], ["1 app", "for field, office & payroll"]].map(([a, b]) => (
              <div key={b}><p className="font-display text-4xl text-brand-navy">{a}</p><p className="mt-1 text-sm text-brand-navy/70">{b}</p></div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-amber">Built for the field</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl md:text-4xl">Everything your technicians and office need — nothing they don’t.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl bg-brand-navy/10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <article key={title} className="bg-brand-ink p-7">
                <Icon className="h-7 w-7 text-brand-amber" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-navy/75">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-20 bg-brand-navy text-brand-ink">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="font-display text-3xl md:text-4xl">Live in an afternoon.</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {[
                [CalendarClock, "Create your company", "Sign up, add your logo and pick your trade. Your workspace is ready instantly."],
                [Smartphone, "Invite the team", "Send join links. Technicians install the app on their phone — no app store needed."],
                [ShieldCheck, "Go paperless", "Dispatch the first job. Clients get a signed, branded report the same day."],
              ].map(([Icon, t, b], i) => {
                const I = Icon as typeof CalendarClock;
                return (
                  <li key={t as string} className="border-t border-brand-amber/50 pt-5">
                    <span className="font-display text-brand-amber">0{i + 1}</span>
                    <I className="mt-3 h-6 w-6" />
                    <h3 className="mt-3 text-lg font-semibold">{t as string}</h3>
                    <p className="mt-2 text-sm text-brand-ink/70">{b as string}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-amber">Simple pricing</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">Start free. Choose a plan when you’re sure.</h2>
            <p className="mt-3 text-brand-navy/70">Prices per month, excl. VAT. Save 10% quarterly or 20% yearly.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <article key={p.name} className={`flex flex-col rounded-xl border p-6 ${p.featured ? "border-brand-amber bg-brand-navy-deep text-brand-ink shadow-xl" : "border-brand-navy/15 bg-brand-ink"}`}>
                {p.featured && <span className="mb-3 self-start rounded-full bg-brand-amber px-2.5 py-0.5 text-xs font-semibold text-brand-navy-deep">Most popular</span>}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-3"><span className="font-display text-4xl">€{p.price}</span><span className="text-sm opacity-70"> /month</span></p>
                <p className="mt-1 text-sm opacity-70">{p.users} users · {p.gb} GB storage</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {p.points.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber" />{x}</li>)}
                </ul>
                <a href={SIGNUP} className={`mt-6 rounded-md px-4 py-2.5 text-center text-sm font-semibold ${p.featured ? "bg-brand-amber text-brand-navy-deep" : "border border-brand-navy/25 hover:border-brand-amber"}`}>Start 60-day trial</a>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-brand-navy/60">Add-on packs from €35/month · Extra storage from €15/month</p>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-brand-navy/10">
          <div className="mx-auto max-w-3xl px-5 py-20">
            <h2 className="font-display text-3xl">Questions</h2>
            <Accordion type="single" collapsible className="mt-6">
              {faqs.map(([q, a]) => (
                <AccordionItem key={q} value={q} className="border-brand-navy/15">
                  <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                  <AccordionContent className="text-brand-navy/75">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="bg-brand-amber">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-16 text-center">
            <h2 className="font-display text-3xl text-brand-navy-deep md:text-4xl">Be one of our launch companies.</h2>
            <p className="max-w-xl text-brand-navy-deep/80">Early adopters get 60 days free and hands-on setup help from the FieldBridge team.</p>
            <a href={SIGNUP} className="inline-flex items-center gap-2 rounded-md bg-brand-navy-deep px-7 py-3 font-semibold text-brand-ink">Claim your free trial <ArrowRight className="h-4 w-4" /></a>
          </div>
        </section>
      </main>

      <footer className="bg-brand-navy-deep text-brand-ink/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm sm:flex-row">
          <div className="flex items-center gap-2"><img src={fieldbridgeMark} alt="" width={24} height={24} className="h-6 w-6" /><span className="text-brand-ink">FieldBridge</span></div>
          <p>© {new Date().getFullYear()} FieldBridge · <a href="mailto:billing@fieldbridgeapp.com" className="hover:text-brand-amber">billing@fieldbridgeapp.com</a></p>
        </div>
      </footer>
    </div>
  );
}
