import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ClipboardCheck, Mail, Menu, Users, Wallet, X } from "lucide-react";
import fieldbridgeMark from "@/assets/fieldbridge-mark.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { listPublicCatalog, type PublicCatalogItem } from "@/lib/public-catalog.functions";
import { CADENCES, cadenceSuffix, formatEur, priceForCadence, type BillingCadence } from "@/lib/catalog-pricing";
import { PLAN_FEATURES } from "@/lib/plan-features";
import { supabase } from "@/integrations/supabase/client";
import { TRUST_LINKS } from "@/lib/trust-pages";

const catalogQueryOptions = queryOptions({
  queryKey: ["public-catalog"],
  queryFn: () => listPublicCatalog(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({ staticData: { sitemap: true },
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions),
  head: () => ({
    meta: [
      { title: "FieldBridge — Field service software for technical contractors" },
      { name: "description", content: "Job sheets, client sign-off, crew dispatch, tracking and billing in one app for HVAC, electrical, lifts, plumbing and maintenance teams. 60-day free trial." },
      { property: "og:title", content: "FieldBridge — Connect your field team and office" },
      { property: "og:description", content: "From first dispatch to paid invoice: digital job sheets, smart dispatch and billing for field service teams. 60 days free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://fieldbridgeapp.com/" },
      { property: "og:image", content: "https://fieldbridgeapp.com/fieldbridge-share.jpg" },
      { name: "twitter:image", content: "https://fieldbridgeapp.com/fieldbridge-share.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://fieldbridgeapp.com/" }],
  }),
  component: Landing,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-center text-sm">{error instanceof Error ? error.message : String(error)}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center text-sm">Page not found.</div>,
});

const SIGNUP = "/auth?mode=signup";
const SALES = "mailto:sales@fieldbridgeapp.com?subject=FieldBridge%20enquiry";
const TRADES = ["HVAC & refrigeration", "Electrical & fire", "Lifts & escalators", "Plumbing & mechanical", "Facilities maintenance", "Security & CCTV"];

const pillars = [
  { icon: ClipboardCheck, title: "Digital job sheets", body: "Photos, checklists and client signatures on site, with a branded PDF sent when the job closes. Works offline." },
  { icon: Users, title: "Dispatch & crews", body: "Assign jobs or let the first free technician claim them. Match skills and see who is on the way." },
  { icon: Wallet, title: "Hours to invoice", body: "Work reports flow into overtime, payroll and billing-ready labour and parts." },
];

type ViewPlan = {
  name: string;
  seats: number;
  gb: number;
  summary: string;
  monthly_price: number | null;
  quarterly_price: number | null;
  yearly_price: number | null;
  modules: string[];
};

/** Shown only if the live catalogue cannot be reached. */
const fallbackPlans: ViewPlan[] = [
  { name: "Basic", seats: 3, gb: 10, summary: "For small teams going paperless.", monthly_price: 89, quarterly_price: null, yearly_price: null, modules: ["Job sheets & client signatures", "Clients, sites & equipment", "Leave & daily work reports", "Offline mobile app"] },
  { name: "Plus", seats: 5, gb: 25, summary: "Your brand and recurring contracts.", monthly_price: 149, quarterly_price: null, yearly_price: null, modules: ["Everything in Basic", "Your own app title & branding", "Contracts & renewals", "Team chat"] },
  { name: "Pro", seats: 10, gb: 100, summary: "Growing contractors with estimating and fleet.", monthly_price: 249, quarterly_price: null, yearly_price: null, modules: ["Everything in Plus", "Estimates & quantity surveying", "Fleet GPS & route history", "Technical library & equipment QR codes"] },
  { name: "Enterprise", seats: 20, gb: 250, summary: "Every module, for larger operations.", monthly_price: 399, quarterly_price: null, yearly_price: null, modules: ["Every module included", "Skills & smart dispatch", "Payroll & payslips", "Priority onboarding"] },
];

const fallbackPacks = [
  { name: "Bronze", monthly_price: 35, blurb: "Brand & document studio" },
  { name: "Silver", monthly_price: 49, blurb: "Field work & fleet" },
  { name: "Gold", monthly_price: 59, blurb: "Estimates & contracts" },
  { name: "Diamond", monthly_price: 89, blurb: "Smart dispatch & payroll" },
];

const featureLabel = (key: string) =>
  PLAN_FEATURES.find((f) => f.key === key)?.label ?? key.replace(/_/g, " ");

const shortLabel = (key: string) => featureLabel(key).split(":")[0];

function toViewPlan(p: PublicCatalogItem): ViewPlan {
  return {
    name: p.name,
    seats: p.included_seats,
    gb: p.storage_gb,
    summary: `${p.included_seats} users and ${p.storage_gb} GB storage included.`,
    monthly_price: p.monthly_price,
    quarterly_price: p.quarterly_price,
    yearly_price: p.yearly_price,
    modules: p.modules.map(featureLabel),
  };
}

const faqs: [string, string][] = [
  ["Do I need a card for the trial?", "No. Create your company, invite your team and use FieldBridge free for 60 days."],
  ["Which trades does it suit?", "Any technical field service team. Rename fields, checklists and job types to match your trade."],
  ["Is our data kept separate?", "Yes. Every company has its own isolated workspace with role-based access."],
  ["What happens after the trial?", "Pick a plan monthly, quarterly (10% off) or yearly (20% off). Your records always stay viewable and exportable."],
];

const nav = [["#features", "Features"], ["#packages", "Packages"], ["#trades", "Trades"], ["#faq", "FAQ"]];

function Landing() {
  // Signed-in users skip the marketing site and land straight in the app.
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState("Pro");
  const [cadence, setCadence] = useState<BillingCadence>("monthly");
  const { data: catalog } = useSuspenseQuery(catalogQueryOptions);

  const live = catalog.plans.length > 0;
  const viewPlans = live ? catalog.plans.map(toViewPlan) : fallbackPlans;
  const plan = viewPlans.find((p) => p.name === sel) ?? viewPlans[0] ?? fallbackPlans[0];

  const livePacks = catalog.packs.filter((p) => p.modules.length > 0);
  const packs = live
    ? livePacks.map((p) => ({ name: p.name, monthly_price: p.monthly_price, blurb: p.modules.slice(0, 3).map(shortLabel).join(" · ") }))
    : fallbackPacks;
  const storagePacks = catalog.packs.filter((p) => p.modules.length === 0 && p.storage_gb > 0);
  const storageFrom = storagePacks.length
    ? Math.min(...storagePacks.map((p) => Number(p.monthly_price ?? Infinity)))
    : 15;

  if (!plan) return <div role="alert" className="p-8 text-center">Packages are currently unavailable.</div>;
  const price = priceForCadence(plan, cadence);
  const cadenceNote =
    cadence === "quarterly" ? "per quarter · 10% off the monthly rate" :
    cadence === "yearly" ? "per year · 20% off the monthly rate" : "per month";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="#top" className="flex items-center gap-2">
            <img src={fieldbridgeMark} alt="" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-semibold text-brand-navy">FieldBridge</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            {nav.map(([h, l]) => <a key={h} href={h} className="hover:text-foreground">{l}</a>)}
            <a href={SALES} className="hover:text-foreground">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="rounded-md border border-border px-3 py-2 text-sm font-medium">Sign in</Link>
            <a href={SIGNUP} className="rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-brand-ink">Start free</a>
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
            <a href={SIGNUP} className="inline-flex items-center gap-2 rounded-md bg-brand-navy px-6 py-3 font-semibold text-brand-ink">Start free trial <ArrowRight className="h-4 w-4" /></a>
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
              <Icon className="h-6 w-6 text-brand-amber" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>

        <section id="packages" className="scroll-mt-20 border-t border-border bg-muted/40">
          <div className="mx-auto max-w-4xl px-5 py-20">
            <h2 className="text-center text-3xl font-semibold text-brand-navy">Choose a package</h2>
            <p className="mt-2 text-center text-muted-foreground">Tap a package to see what's included. Prices excl. VAT.</p>

            <div className="mt-8 flex justify-center">
              <div className="inline-flex rounded-md border border-border bg-background p-1" role="group" aria-label="Billing period">
                {CADENCES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCadence(c.key)}
                    aria-pressed={cadence === c.key}
                    className={`rounded px-3 py-2 text-sm font-medium transition sm:px-4 ${cadence === c.key ? "bg-brand-navy text-brand-ink" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {c.label}
                    {c.badge && (
                      <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${cadence === c.key ? "bg-brand-amber text-brand-navy-deep" : "bg-muted text-muted-foreground"}`}>
                        {c.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div role="tablist" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {viewPlans.map((p) => (
                <button key={p.name} role="tab" aria-selected={plan.name === p.name} onClick={() => setSel(p.name)}
                  className={`rounded-md border px-4 py-3 text-left transition ${plan.name === p.name ? "border-brand-navy bg-brand-navy text-brand-ink" : "border-border bg-background hover:border-brand-navy"}`}>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-sm opacity-80">{formatEur(priceForCadence(p, cadence))}{cadenceSuffix(cadence)}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-card p-6 md:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-semibold text-brand-navy">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.seats} users · {plan.gb} GB storage</p>
              </div>
              <p className="mt-1 text-muted-foreground">{plan.summary}</p>
              <p className="mt-4 text-2xl font-semibold text-brand-navy">
                {formatEur(price)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{cadenceNote}</span>
              </p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Included modules</p>
                  <ul className="mt-3 space-y-2 text-sm">{plan.modules.map((m) => <li key={m} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber" />{m}</li>)}</ul>
                </div>
                <div>
                  <p className="text-sm font-medium">Optional add-ons</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {packs.map((p) => (
                      <li key={p.name}>
                        <span className="font-medium text-foreground">+ {p.name} — {formatEur(p.monthly_price)}/mo</span>
                        {p.blurb && <span className="block text-xs">{p.blurb}</span>}
                      </li>
                    ))}
                    <li>+ Extra storage from {formatEur(storageFrom)}/mo</li>
                  </ul>
                </div>
              </div>
              <a href={SIGNUP} className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand-navy px-5 py-2.5 text-sm font-semibold text-brand-ink">Start free trial <ArrowRight className="h-4 w-4" /></a>
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">Save 10% quarterly or 20% yearly. Prices update automatically from our catalogue.</p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-20">
          <h2 className="text-3xl font-semibold text-brand-navy">Questions</h2>
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
            <a href={SALES} className="mt-3 inline-flex items-center gap-2 text-brand-navy"><Mail className="h-4 w-4" /> sales@fieldbridgeapp.com</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-5 gap-y-3 px-5 pt-6 text-sm text-muted-foreground">{TRUST_LINKS.map(([to, label]) => <Link key={to} to={to} className="hover:text-foreground">{label}</Link>)}<a href="/sitemap.xml" className="hover:text-foreground">Sitemap</a></div>
        <img src="/fieldbridge-share.jpg" alt="FieldBridge — Field service team and office" width={1200} height={630} loading="lazy" className="mx-auto mt-6 w-64 max-w-full" />
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2"><img src={fieldbridgeMark} alt="" width={20} height={20} className="h-5 w-5" /><span>© {new Date().getFullYear()} FieldBridge</span></div>
          <div className="flex gap-5"><a href={SALES} className="hover:text-foreground">Contact sales</a><Link to="/auth" className="hover:text-foreground">Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
