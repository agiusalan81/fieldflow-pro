import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { analyticsFeature } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { useUserPreview } from "@/lib/impersonation";
export function AnalyticsTracker() {
  const { data: actor } = useProfile();
  const preview = useUserPreview(actor);
  const path = useRouterState({ select: s => s.location.pathname });
  useEffect(() => {
    if (!actor || preview.active || actor.role !== actor.real_role) return;
    const feature = analyticsFeature(path);
    const day = new Date().toISOString().slice(0, 10);
    for (const key of ["sign_in", ...(feature ? [feature] : [])]) {
      const cache = `hq-usage:${actor.id}:${day}:${key}`;
      if (sessionStorage.getItem(cache)) continue;
      sessionStorage.setItem(cache, "1");
      void Promise.resolve(supabase.rpc("record_platform_usage", { _feature: key })).then(r => { if (r.error) sessionStorage.removeItem(cache); }).catch(() => sessionStorage.removeItem(cache));
    }
  }, [actor?.id, actor?.role, actor?.real_role, preview.active, path]);
  return null;
}