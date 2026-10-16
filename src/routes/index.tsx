import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FieldOps — Field service management for your team" },
      { name: "description", content: "Job sheets, assets, inventory and technician scheduling in one customizable workspace." },
      { property: "og:title", content: "FieldOps — Field service management" },
      { property: "og:description", content: "Job sheets, assets, inventory and technician scheduling in one customizable workspace." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-widest text-primary">Field service, organised</p>
        <h1 className="mt-4 font-display text-5xl leading-tight text-foreground">
          Every job, asset and technician in one place.
        </h1>
        <Button asChild size="lg" className="mt-8">
          <Link to="/auth">Create your company</Link>
        </Button>
      </div>
    </main>
  );
}
