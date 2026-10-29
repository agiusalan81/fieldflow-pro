import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { createDraftSheet, needsClockIn } from "@/lib/jobsheets";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ShiftClockInDialog } from "@/components/shift-clock-in-dialog";
import { clockInShift } from "@/lib/shift-clock-in";

export const Route = createFileRoute("/_authenticated/sheets/new")({ staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): { jobId?: string | undefined } => ({ jobId: typeof s["jobId"] === "string" ? s["jobId"] : undefined }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "New job sheet — FieldBridge" },
      { name: "description", content: "Start a new job sheet." },
      { property: "og:title", content: "New job sheet — FieldBridge" },
      { property: "og:description", content: "Start a new job sheet." },
    ],
  }),
  component: NewSheet,
});

function NewSheet() {
  const { jobId } = Route.useSearch();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [offShift, setOffShift] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);

  const start = () => {
    if (!profile) return;
    createDraftSheet(profile, jobId)
      .then((id) => navigate({ to: "/sheets/$sheetId", params: { sheetId: id }, replace: true }))
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    if (!profile || started.current) return;
    started.current = true;
    (async () => {
      const { data } = await supabase.from("shifts").select("shift_type").eq("user_id", profile.id).is("ended_at", null);
      if (needsClockIn(profile.real_role, (data ?? []).map((s) => s.shift_type))) {
        // Standby technicians may open callout sheets after clocking out (tonight or after midnight).
        const d = new Date(), y = new Date(Date.now() - 86_400_000);
        const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
        const [a, b] = await Promise.all([supabase.rpc("is_on_standby", { _user: profile.id, _date: ymd(d) }), supabase.rpc("is_on_standby", { _user: profile.id, _date: ymd(y) })]);
        if (!a.data && !b.data) { setOffShift(true); return; }
        toast.info("Standby callout — this sheet will be added to your held daily works report.");
      }
      start();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const clockInAndStart = async (plate: string, use: import('@/lib/vehicle-clock-in').VehicleUse) => {
    if (!profile) return;
    await clockInShift(profile, plate,use);
    qc.invalidateQueries({ queryKey: ["open-shifts"] });
    toast.success("Clocked in");
    setOffShift(false);
    start();
  };

  return (
    <AppShell title="New job sheet">
      {offShift ? (
        <div className="mx-auto max-w-md space-y-4 rounded-xl border bg-card p-6 text-center">
          <h2 className="font-display text-lg text-foreground">You're not clocked in</h2>
          <p className="text-sm text-muted-foreground">Clock in to start a job sheet so your hours are recorded.</p>
          <Button className="h-12 w-full" onClick={() => setPlateOpen(true)}>Clock in & start</Button>
          <Button variant="ghost" className="w-full" onClick={() => window.history.back()}>Back</Button>
        </div>
      ) : (
        <p className="text-muted-foreground">{error ?? "Preparing your job sheet…"}</p>
      )}
      {profile && <ShiftClockInDialog userId={profile.id} open={plateOpen} onOpenChange={setPlateOpen} onConfirm={clockInAndStart} label="Clock in & start" />}
    </AppShell>
  );
}
