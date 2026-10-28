import { usePlanFeatures } from "@/lib/plan-features";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { TechnicalLibrary } from "@/components/technical-library";
import { AssetHistory } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { PpmVisits } from "@/components/ppm-visits";
import { AssetComponents } from "@/components/asset-components";
import { LiftPassport } from "@/components/lift-passport";
import { useProfile, isManager, isOffice } from "@/lib/profile";
import { LiftInspections } from "@/components/lift-inspections";
import { z } from 'zod';
export const Route = createFileRoute("/_authenticated/equipment/$assetId")({
  staticData: { sitemap: false },
  validateSearch: z.object({view:z.enum(['overview','passport']).default('overview'),submission:z.string().uuid().optional()}),
  head: () => ({
    meta: [
      { title: "Equipment records — FieldBridge" },
      {
        name: "description",
        content: "Authorised equipment details, service history and technical documents.",
      },
      { property: "og:title", content: "Equipment records — FieldBridge" },
      {
        property: "og:description",
        content: "Private company equipment and technical-library access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EquipmentPage,
});
function EquipmentPage() {
  const on = usePlanFeatures();
  const { data: profile } = useProfile();
  const { assetId } = Route.useParams();
  const {view,submission}=Route.useSearch();
  const focused=view==='passport';
  const q = useQuery({
    queryKey: ["equipment-detail", assetId],
    queryFn: async () => {
      const r = await supabase
        .from("assets")
        .select(
          "id,reference_number,asset_category,serial_number,location_details,site_id,client_id,sites(name)",
        )
        .eq("id", assetId)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <AppShell title={focused ? 'Technical passport' : q.data?.reference_number ?? "Equipment"}>
      {q.isPending ? (
        <p>Loading equipment…</p>
      ) : q.error || !q.data ? (
        <EmptyState>Equipment unavailable or not authorised for this account.</EmptyState>
      ) : (
        <div className="mx-auto max-w-5xl space-y-8">
          <Button variant="ghost" size="sm" onClick={() => window.history.length > 1 ? window.history.back() : void 0}>← Back</Button>
          <section className="space-y-2 border-b pb-5">
            <h1 className="text-2xl font-semibold">{q.data.reference_number}</h1>
            <p>
              {q.data.asset_category} · {q.data.sites?.name}
            </p>
            <p className="text-sm text-muted-foreground">
              Serial {q.data.serial_number ?? "—"} · {q.data.location_details ?? ""}
            </p>
          </section>
          {focused&&<Button asChild variant="outline"><Link to="/equipment/$assetId" params={{assetId}} search={{view:'overview'}}>Back to equipment overview</Link></Button>}
          {focused&&!on('lift_pack')&&<EmptyState>Technical passports require the Lift Industry Pack.</EmptyState>}
          
          {on("lift_pack") && (
            <section id="passport" className="scroll-mt-20">
            <LiftPassport
              assetId={assetId}
              assetCategory={q.data.asset_category}
              canManage={isManager(profile)}
              asset={q.data}
              focus={submission}
            />
            </section>
          )}
          {!focused&&on("lift_pack") && <LiftInspections assetId={assetId} canManage={isManager(profile)} />}
          {!focused&&on("ppm_automation") && (
            <>
              <PpmVisits assetId={assetId} canManage={isManager(profile)} />
              <AssetComponents assetId={assetId} canManage={isManager(profile)} />
            </>
          )}
          {!focused&&on("technical_library") && (
            <section>
              <h2 className="mb-4 font-medium">Technical library</h2>
              <TechnicalLibrary initialAsset={assetId} initialSite={q.data.site_id ?? ""} />
            </section>
          )}
          {!focused&&<section>
            <h2 className="mb-4 font-medium">Service history</h2>
            <AssetHistory assetId={assetId} label={q.data.reference_number} />
          </section>}
          <Button asChild variant="outline">
            <Link to="/dashboard">My dashboard</Link>
          </Button>
        </div>
      )}
    </AppShell>
  );
}
