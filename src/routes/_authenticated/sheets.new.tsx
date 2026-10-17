import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useProfile } from "@/lib/profile";
import { createDraftSheet } from "@/lib/jobsheets";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/sheets/new")({
  validateSearch: (s: Record<string, unknown>): { jobId?: string } => ({ jobId: typeof s.jobId === "string" ? s.jobId : undefined }),
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
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!profile || started.current) return;
    started.current = true;
    createDraftSheet(profile, jobId)
      .then((id) => navigate({ to: "/sheets/$sheetId", params: { sheetId: id }, replace: true }))
      .catch((e: Error) => setError(e.message));
  }, [profile, jobId, navigate]);
  return (
    <AppShell title="New job sheet">
      <p className="text-muted-foreground">{error ?? "Preparing your job sheet…"}</p>
    </AppShell>
  );
}
