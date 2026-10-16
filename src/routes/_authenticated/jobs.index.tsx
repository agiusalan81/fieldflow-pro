import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { AppShell, StatusBadge, EmptyState } from "@/components/app-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({
    meta: [
      { title: "My jobs — FieldOps" },
      { name: "description", content: "Job sheets assigned to you, grouped by status." },
      { property: "og:title", content: "My jobs — FieldOps" },
      { property: "og:description", content: "Job sheets assigned to you, grouped by status." },
    ],
  }),
  component: JobsPage,
});

const TABS = [
  ["pending", "Pending"],
  ["in_transit", "In transit"],
  ["in_progress", "In progress"],
  ["completed", "Completed"],
] as const;

function JobsPage() {
  const { data: profile } = useProfile();
  const { data: jobs = [] } = useQuery({
    queryKey: ["my-jobs-full", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sheets")
        .select("id, status, notes, created_at, is_overtime, clients(name, billing_address), assets(reference_number, asset_category, location_details)")
        .eq("assigned_technician_id", profile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="My jobs">
      <Tabs defaultValue="pending" className="mx-auto max-w-4xl">
        <TabsList className="grid h-auto w-full grid-cols-4">
          {TABS.map(([k, l]) => (
            <TabsTrigger key={k} value={k} className="flex-col gap-0.5 py-2 text-xs sm:flex-row sm:gap-2 sm:text-sm">
              {l} <span className="text-muted-foreground">{jobs.filter((j) => j.status === k).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(([k]) => {
          const list = jobs.filter((j) => j.status === k);
          return (
            <TabsContent key={k} value={k} className="mt-4">
              {list.length === 0 ? (
                <EmptyState>No jobs here.</EmptyState>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {list.map((j) => (
                    <Link key={j.id} to="/jobs/$jobId" params={{ jobId: j.id }} className="block rounded-xl border bg-card p-4 active:bg-accent">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-medium text-foreground">{j.clients?.name}</p>
                        <StatusBadge status={j.status} />
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {j.assets ? `${j.assets.reference_number} · ${j.assets.asset_category}` : "No asset linked"}
                      </p>
                      {(j.assets?.location_details || j.clients?.billing_address) && (
                        <p className="mt-2 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> {j.assets?.location_details || j.clients?.billing_address}
                        </p>
                      )}
                      {j.is_overtime && <p className="mt-2 text-xs font-medium text-warning-foreground">Overtime</p>}
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </AppShell>
  );
}
