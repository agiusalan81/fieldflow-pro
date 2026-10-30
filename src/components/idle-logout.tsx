import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { shouldAutoLogout, clampIdle } from "@/lib/idle";
import { isLoadedTestSession, TEST_RETURN_KEY } from '@/lib/shift-session';
import { setViewAs } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WARN_MS = 60_000;

export function IdleLogout({ userId, realRole, timeoutMin }: { userId: string; realRole: string; timeoutMin: number }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const last = useRef(Date.now());
  const [warn, setWarn] = useState(false);
  const [left, setLeft] = useState(60);
  const t = clampIdle(timeoutMin);

  useEffect(() => {
    if (!t) return;
    const bump = () => { if (!warnRef.current) last.current = Date.now(); };
    const evs = ["click", "keydown", "touchstart", "scroll", "mousemove"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    let checking = false;
    let disposed = false;
    const iv = setInterval(async () => {
      if (checking || disposed) return;
      const idleMs = Date.now() - last.current;
      if (idleMs < t * 60_000 - WARN_MS) return;
      if (isLoadedTestSession(userId, sessionStorage.getItem(TEST_RETURN_KEY))) { stay(); return; }
      checking = true;
      try {
      const { data, error } = await supabase.from("shifts").select("id").eq("user_id", userId).in("shift_type", ["shift", "standby"]).is("ended_at", null).limit(1);
      if (disposed) return;
      // Failed reads must not turn an active shift into a presumed clock-out.
      if (error || !data || data.length > 0) { stay(); return; }
      const freshIdleMs = Date.now() - last.current;
      if (shouldAutoLogout({ idleMs: freshIdleMs + WARN_MS, timeoutMin: t, isTechnician: realRole === "technician", clockedIn: false })) {
        if (freshIdleMs >= t * 60_000) {
          setViewAs(null);
          await qc.cancelQueries(); qc.clear();
          await supabase.auth.signOut();
          navigate({ to: "/auth", search: { reason: "idle" } as never, replace: true });
        } else { warnRef.current = true; setWarn(true); setLeft(Math.ceil((t * 60_000 - freshIdleMs) / 1000)); }
      }
      } catch { if (!disposed) stay(); }
      finally { checking = false; }
    }, 5_000);
    return () => { disposed = true; evs.forEach((e) => window.removeEventListener(e, bump)); clearInterval(iv); };
  }, [t, userId, realRole, navigate, qc]);

  const warnRef = useRef(false);
  const stay = () => { warnRef.current = false; last.current = Date.now(); setWarn(false); };

  return (
    <Dialog open={warn} onOpenChange={(o) => { if (!o) stay(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>You will be signed out in about {left} seconds because of inactivity.</DialogDescription>
        </DialogHeader>
        <DialogFooter><Button onClick={stay}>Keep working</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
