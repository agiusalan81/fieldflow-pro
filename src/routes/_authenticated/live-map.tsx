import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyState } from "@/components/app-shell";
import { LiveLocations } from "@/components/live-locations";
import { useProfile, isManager } from "@/lib/profile";
import { LocationAudit } from '@/components/location-audit';

export const Route = createFileRoute("/_authenticated/live-map")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Live team map — FieldBridge" },
      { name: "description", content: "See where clocked-in technicians and supervisors are right now." },
      { property: "og:title", content: "Live team map — FieldBridge" },
      { property: "og:description", content: "Live positions of your clocked-in team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveMapPage,
});

function LiveMapPage() {
  const { data: profile } = useProfile();
  return (
    <AppShell title="Live team map">
      {!isManager(profile) ? <EmptyState>The live map is for supervisors and office staff.</EmptyState> : <div className="space-y-8"><LiveLocations tall /><LocationAudit/></div>}
    </AppShell>
  );
}
