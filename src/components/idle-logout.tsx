import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { shouldAutoLogout, clampIdle } from "@/lib/idle";
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
    const iv = setInterval(async () => {
      const idleMs = Date.now() - last.current;
      if (idleMs < t * 60_000 - WARN_MS) return;
      let clockedIn = false;
      if (realRole === "technician") {
        const { data } = await supabase.from("shifts").select("id").eq("user_id", userId).eq("shift_type", "shift").is("ended_at", null).limit(1);
        clockedIn = !!data?.length;
      }
      if (shouldAutoLogout({ idleMs: idleMs + WARN_MS, timeoutMin: t, isTechnician: realRole === "technician", clockedIn })) {
        if (idleMs >= t * 60_000) {
          setViewAs(null);
          await qc.cancelQueries(); qc.clear();
          await supabase.auth.signOut();
          navigate({ to: "/auth", search: { reason: "idle" } as never, replace: true });
        } else { warnRef.current = true; setWarn(true); setLeft(Math.ceil((t * 60_000 - idleMs) / 1000)); }
      }
    }, 5_000);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump)); clearInterval(iv); };
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
