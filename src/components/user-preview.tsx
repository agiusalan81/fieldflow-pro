import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RotateCcw, Users } from "lucide-react";
import { useProfile, ROLE_LABEL, setViewAs } from "@/lib/profile";
import { clearUserPreview, selectPreviewUser, useUserPreview, USER_PREVIEW_PATHS } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UserPreviewControl() {
  const { data: actor } = useProfile();
  const preview = useUserPreview(actor);
  const navigate = useNavigate();
  if (!actor || !preview.eligible) return null;
  return (
    <div className="min-w-0">
      <Select value={preview.member?.id ?? "self"} disabled={preview.isLoading || !!preview.error}
        onValueChange={(id) => {
          setViewAs(null);
          selectPreviewUser(actor, id === "self" ? null : id, preview.members);
          void navigate({ to: "/dashboard" });
        }}>
        <SelectTrigger className="h-9 w-[180px] max-w-full border-dashed text-xs" aria-label="View as user">
          <Users className="mr-1 h-4 w-4 shrink-0" /><SelectValue placeholder="View as user" />
        </SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-2rem)]">
          <SelectItem value="self">My account</SelectItem>
          {preview.members.filter((u) => u.id !== actor.id).map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.full_name} · {ROLE_LABEL[u.role]}{u.technician_initials ? ` · ${u.technician_initials}` : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preview.error && <p className="text-xs text-destructive">Unable to load users.</p>}
    </div>
  );
}

export function UserPreviewBanner() {
  const { data: actor } = useProfile();
  const { member } = useUserPreview(actor);
  if (!member) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b bg-warning/15 px-4 py-2 text-sm text-foreground sm:px-6">
      <span className="min-w-0 break-words">Viewing as <strong>{member.full_name}</strong> · {ROLE_LABEL[member.role]} · Read-only testing</span>
      <Button size="sm" variant="outline" onClick={clearUserPreview}><RotateCcw className="mr-1 h-4 w-4" />Reset to self</Button>
    </div>
  );
}

/** Block non-preview screens so target reads cannot spill into editing, signatures or offline draft writes. */
export function UserPreviewBoundary({ children }: { children: ReactNode }) {
  const { data: actor } = useProfile();
  const { active } = useUserPreview(actor);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  if (!active || USER_PREVIEW_PATHS.includes(path.replace(/\/$/, ""))) return children;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <UserPreviewBanner />
      <div className="mx-auto max-w-xl space-y-4 px-6 py-12">
        <h1 className="font-display text-2xl">Read-only user preview</h1>
        <p className="text-muted-foreground">This page is only available from your own account.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate({ to: "/dashboard" })}>Back to preview</Button>
          <Button variant="outline" onClick={clearUserPreview}>Reset to self</Button>
        </div>
      </div>
    </div>
  );
}