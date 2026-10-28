import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AisleOpsDemo } from "@/components/aisleops-demo";
import { Button } from "@/components/ui/button";

const TITLE = "AisleOps Interactive Demo | Supermarket Maintenance Workflow";
const DESC = "Try the AisleOps demo: QR fault reporting from the shop floor, urgent refrigeration dispatch, technician clock-in and the Daily Work Report.";

export const Route = createFileRoute("/demo")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  useEffect(() => { document.documentElement.dataset["edition"] = "retail"; return () => { delete document.documentElement.dataset["edition"]; }; }, []);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/retail" className="font-display text-xl font-bold uppercase">AisleOps</Link>
          <Button asChild variant="secondary" size="sm"><a href="mailto:hello@fieldbridgeapp.com?subject=AisleOps%20demo">Book a call</a></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">From shop floor to fixed — in 60 seconds</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Click through a real supermarket maintenance job: a chiller fault reported by QR code, dispatched, fixed and logged in the Daily Work Report.</p>
        <div className="mt-8"><AisleOpsDemo /></div>
      </main>
    </div>
  );
}
