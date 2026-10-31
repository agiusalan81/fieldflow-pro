import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, GraduationCap, MousePointer2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guideKey, guideSteps } from "@/lib/onboarding";
import type { Profile } from "@/lib/profile";

type Box = { top: number; left: number; width: number; height: number };

/** Finds the first visible element marked data-tour="id" (menus exist twice: desktop and phone). */
function findTarget(id: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`));
  return all.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
}

/** Tracks the target's on-screen box, waiting briefly for the page to render it. */
function useTargetBox(id: string | undefined, path: string) {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    setBox(null);
    if (!id) return;
    let frame = 0; let tries = 0; let el: HTMLElement | null = null; let stop = false;
    const tick = () => {
      if (stop) return;
      if (!el || !el.isConnected) {
        el = findTarget(id);
        if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
        else if (++tries > 180) { setBox(null); return; }
      }
      if (el) {
        const r = el.getBoundingClientRect();
        setBox((b) => b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height ? b : { top: r.top, left: r.left, width: r.width, height: r.height });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(frame); };
  }, [id, path]);
  return box;
}

export function WelcomeGuide({ profile, allowed }: { profile: Profile; allowed: string[] }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const key = guideKey(profile.id, profile.company_id);
  const steps = guideSteps(profile.real_role).filter((s) => allowed.includes(s.to));
  // A previous tab/session must never reopen a tour over first-run setup.
  useEffect(() => {
    setOpen(false);
    setIndex(0);
    try { sessionStorage.removeItem(`${key}:step`); } catch { /* optional storage */ }
  }, [key]);
  // Hide while any setup/permission dialog is open so the two overlays never fight over taps.
  const [dialogOpen, setDialogOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      const blocked = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')).some(el =>
        !el.hasAttribute('data-welcome-tour') && el.dataset['state'] !== 'closed' && el.getClientRects().length > 0);
      setDialogOpen(blocked);
      if (blocked) setOpen(false);
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "hidden", "style"] });
    return () => mo.disconnect();
  }, []);
  const finish = () => { try { localStorage.setItem(key, "done"); sessionStorage.removeItem(`${key}:step`); } catch { /* guide works without storage */ } setOpen(false); };
  const go = (next: number) => { const step = steps[next]; if (!step) return; setIndex(next); try { sessionStorage.setItem(`${key}:step`, String(next)); } catch { /* ignore */ } if (step.to !== path) void navigate({ to: step.to }); };
  const step = steps[index];
  const box = useTargetBox(open && !dialogOpen && step && step.to === path ? step.target : undefined, path);

  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(448, vw - 32);
  const below = box ? box.top + box.height + 190 < vh : true;
  const cardStyle: React.CSSProperties | undefined = box ? {
    position: "fixed", width: cardW,
    left: Math.max(16, Math.min(box.left + box.width / 2 - cardW / 2, vw - cardW - 16)),
    ...(below ? { top: Math.min(box.top + box.height + pad + 28, vh - 200) } : { bottom: Math.max(16, vh - box.top + pad + 28) }),
  } : undefined;

  return <>
    <Button variant="ghost" size="icon" aria-label="Start guided tour" title="Guided tour" disabled={dialogOpen} onClick={() => { setOpen(true); go(0); }}><GraduationCap className="h-5 w-5" /></Button>
    {open && !dialogOpen && step && typeof document !== "undefined" && createPortal(<>
      {box && <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
        <div className="absolute rounded-lg ring-4 ring-primary transition-all duration-300"
          style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2, boxShadow: "0 0 0 9999px color-mix(in oklab, var(--foreground) 55%, transparent)" }} />
        <MousePointer2 className="absolute h-8 w-8 animate-bounce fill-primary text-primary-foreground drop-shadow-lg"
          style={below ? { top: box.top + box.height + 2, left: box.left + Math.min(box.width / 2, 48) } : { top: box.top - 40, left: box.left + Math.min(box.width / 2, 48), transform: "rotate(180deg)" }} />
      </div>}
      <aside role="dialog" data-welcome-tour aria-modal="false" aria-label="Guided tour" style={cardStyle}
        className={`z-[61] rounded-lg border bg-card p-4 text-card-foreground shadow-lg ${box ? "" : "fixed inset-x-4 bottom-24 mx-auto max-w-md lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[28rem]"}`}>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Guided tour · {index + 1} of {steps.length}</p><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close guided tour" onClick={finish}><X className="h-4 w-4" /></Button></div>
        <h2 className="mt-1 text-lg font-semibold">{step.title}</h2><p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
        <div className="mt-4 flex items-center justify-between gap-2"><label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="h-4 w-4 accent-primary" onChange={(e) => { if (e.target.checked) finish(); }} />Don't show again</label><div className="flex gap-2"><Button size="icon" variant="outline" disabled={index === 0} aria-label="Previous step" onClick={() => go(index - 1)}><ArrowLeft className="h-4 w-4" /></Button><Button size="sm" onClick={() => index === steps.length - 1 ? finish() : go(index + 1)}>{index === steps.length - 1 ? "Finish" : "Next"}<ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>
      </aside>
    </>, document.body)}
  </>;
}
