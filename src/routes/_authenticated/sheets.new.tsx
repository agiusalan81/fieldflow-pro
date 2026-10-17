import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { createDraftSheet, needsClockIn } from "@/lib/jobsheets";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/sheets/new")({
  validateSearch: (s: Record<string, unknown>): { jobId?: string | undefined } => ({ jobId: typeof s["jobId"] === "string" ? s["jobId"] : undefined }),
  head: () => ({
    meta: [
      { title: "New job sheet — FieldOps" },
      { name: "description", content: "Start a new job sheet." },
      { property: "og:title", content: "New job sheet — FieldOps" },
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
  const [busy, setBusy] = useState(false);

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
      if (needsClockIn(profile.real_role, (data ?? []).map((s) => s.shift_type))) { setOffShift(true); return; }
      start();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const clockInAndStart = async () => {
    if (!profile) return;
    setBusy(true);
    const { error: e } = await supabase.from("shifts").insert({ shift_type: "shift", company_id: profile.company_id, user_id: profile.id });
    if (e) { setBusy(false); toast.error(e.message); return; }
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
          <Button className="h-12 w-full" disabled={busy} onClick={clockInAndStart}>Clock in & start</Button>
          <Button variant="ghost" className="w-full" onClick={() => window.history.back()}>Back</Button>
        </div>
      ) : (
        <p className="text-muted-foreground">{error ?? "Preparing your job sheet…"}</p>
      )}
    </AppShell>
  );
}
