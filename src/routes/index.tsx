import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, ClipboardCheck, Mail, Menu, Users, Wallet, X } from "lucide-react";
import fieldbridgeMark from "@/assets/fieldbridge-mark.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FieldBridge — Field service software for technical contractors" },
      { name: "description", content: "Job sheets, client sign-off, crew dispatch, tracking and billing in one app for HVAC, electrical, lifts, plumbing and maintenance teams. 60-day free trial." },
      { property: "og:title", content: "FieldBridge — Connect your field team and office" },
      { property: "og:description", content: "From first dispatch to paid invoice: digital job sheets, smart dispatch and billing for field service teams. 60 days free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const SIGNUP = "/auth?mode=signup";
const SALES = "mailto:sales@fieldbridgeapp.com?subject=FieldBridge%20enquiry";
const TRADES = ["HVAC & refrigeration", "Electrical & fire", "Lifts & escalators", "Plumbing & mechanical", "Facilities maintenance", "Security & CCTV"];

const pillars = [
  { icon: ClipboardCheck, title: "Digital job sheets", body: "Photos, checklists and client signatures on site, with a branded PDF sent when the job closes. Works offline." },
  { icon: Users, title: "Dispatch & crews", body: "Assign jobs or let the first free technician claim them. Match skills and see who is on the way." },
  { icon: Wallet, title: "Hours to invoice", body: "Work reports flow into overtime, payroll and billing-ready labour and parts." },
];

type Plan = { name: string; price: number; users: number; gb: number; summary: string; modules: string[]; packs: string[] };
const plans: Plan[] = [
  { name: "Basic", price: 89, users: 3, gb: 10, summary: "For small teams going paperless.", modules: ["Job sheets & client signatures", "Clients, sites & equipment", "Leave & daily work reports", "Offline mobile app"], packs: ["Bronze — brand & document studio (€35)", "Silver — field work & fleet (€49)"] },
  { name: "Plus", price: 149, users: 5, gb: 25, summary: "Your brand and recurring contracts.", modules: ["Everything in Basic", "Your own app title & branding", "Contracts & renewals", "Team chat"], packs: ["Silver — field work & fleet (€49)", "Gold — estimates & contracts (€59)"] },
  { name: "Pro", price: 249, users: 10, gb: 100, summary: "Growing contractors with estimating and fleet.", modules: ["Everything in Plus", "Estimates & quantity surveying", "Fleet GPS & route history", "Technical library & equipment QR codes"], packs: ["Diamond — smart dispatch & payroll (€89)"] },
  { name: "Enterprise", price: 399, users: 20, gb: 250, summary: "Every module, for larger operations.", modules: ["Every module included", "Skills & smart dispatch", "Payroll & payslips", "Priority onboarding"], packs: ["Extra storage only"] },
];

const faqs: [string, string][] = [
  ["Do I need a card for the trial?", "No. Create your company, invite your team and use FieldBridge free for 60 days."],
  ["Which trades does it suit?", "Any technical field service team. Rename fields, checklists and job types to match your trade."],
  ["Is our data kept separate?", "Yes. Every company has its own isolated workspace with role-based access."],
  ["What happens after the trial?", "Pick a plan monthly, quarterly (10% off) or yearly (20% off). Your records always stay viewable and exportable."],
];

const nav = [["#features", "Features"], ["#packages", "Packages"], ["#trades", "Trades"], ["#faq", "FAQ"]];

function Landing() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState("Pro");
  const plan = plans.find((p) => p.name === sel)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="#top" className="flex items-center gap-2">
            <img src={fieldbridgeMark} alt="" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-semibold">FieldBridge</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            {nav.map(([h, l]) => <a key={h} href={h} className="hover:text-foreground">{l}</a>)}
            <a href={SALES} className="hover:text-foreground">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden px-3 py-2 text-sm font-medium sm:inline">Sign in</Link>
            <a href={SIGNUP} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Start free</a>
            <button aria-label="Menu" onClick={() => setOpen(!open)} className="p-2 md:hidden">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {open && (
          <nav className="flex flex-col border-t border-border px-5 py-3 text-sm md:hidden">
            {nav.map(([h, l]) => <a key={h} href={h} onClick={() => setOpen(false)} className="py-2">{l}</a>)}
            <a href={SALES} className="py-2">Contact sales</a>
            <Link to="/auth" className="py-2 font-medium">Sign in</Link>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="mx-auto max-w-4xl px-5 py-20 text-center md:py-28">
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">60-day free trial · no card needed</span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">Connect your field team and office — from first dispatch to paid invoice.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Job sheets, client sign-off, crew dispatch and billing in one simple app for technical contractors and maintenance teams.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={SIGNUP} className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground">Start free trial <ArrowRight className="h-4 w-4" /></a>
            <a href="#packages" className="rounded-md border border-border px-6 py-3 font-medium hover:bg-muted">View packages</a>
          </div>
        </section>

        <section id="trades" className="scroll-mt-20 border-y border-border bg-muted/40">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-6 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Built for:</span>
            {TRADES.map((t) => <span key={t}>{t}</span>)}
          </div>
        </section>

        <section id="features" className="mx-auto grid max-w-6xl scroll-mt-20 gap-6 px-5 py-20 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-lg border border-border p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>

        <section id="packages" className="scroll-mt-20 border-t border-border bg-muted/40">
          <div className="mx-auto max-w-4xl px-5 py-20">
            <h2 className="text-center text-3xl font-semibold">Choose a package</h2>
            <p className="mt-2 text-center text-muted-foreground">Tap a package to see what's included. Prices per month, excl. VAT.</p>
            <div role="tablist" className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {plans.map((p) => (
                <button key={p.name} role="tab" aria-selected={sel === p.name} onClick={() => setSel(p.name)}
                  className={`rounded-md border px-4 py-3 text-left transition ${sel === p.name ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary"}`}>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-sm opacity-80">€{p.price}/mo</span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-background p-6 md:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.users} users · {plan.gb} GB storage</p>
              </div>
              <p className="mt-1 text-muted-foreground">{plan.summary}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Included modules</p>
                  <ul className="mt-3 space-y-2 text-sm">{plan.modules.map((m) => <li key={m} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{m}</li>)}</ul>
                </div>
                <div>
                  <p className="text-sm font-medium">Optional add-ons</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{plan.packs.map((m) => <li key={m}>+ {m}</li>)}<li>+ Extra storage from €15</li></ul>
                </div>
              </div>
              <a href={SIGNUP} className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Start free trial <ArrowRight className="h-4 w-4" /></a>
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">Save 10% quarterly or 20% yearly.</p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-20">
          <h2 className="text-3xl font-semibold">Questions</h2>
          <Accordion type="single" collapsible className="mt-6">
            {faqs.map(([q, a]) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-12 rounded-lg border border-border p-6 text-center">
            <p className="font-medium">Want a walkthrough for your team?</p>
            <a href={SALES} className="mt-3 inline-flex items-center gap-2 text-primary"><Mail className="h-4 w-4" /> sales@fieldbridgeapp.com</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2"><img src={fieldbridgeMark} alt="" width={20} height={20} className="h-5 w-5" /><span>© {new Date().getFullYear()} FieldBridge</span></div>
          <div className="flex gap-5"><a href={SALES} className="hover:text-foreground">Contact sales</a><Link to="/auth" className="hover:text-foreground">Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
