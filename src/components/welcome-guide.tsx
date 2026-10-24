import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guideKey, guideSteps } from "@/lib/onboarding";
import type { Profile } from "@/lib/profile";

export function WelcomeGuide({ profile, allowed }: { profile: Profile; allowed: string[] }) {
  const navigate = useNavigate();
  const path = useRouterState({select:s=>s.location.pathname});
  const [open,setOpen] = useState(false);
  const [index,setIndex] = useState(0);
  const key = guideKey(profile.id,profile.company_id);
  const steps = guideSteps(profile.real_role).filter(s=>allowed.includes(s.to));
  useEffect(()=>{
    try {
      const live = sessionStorage.getItem(`${key}:step`);
      if (live !== null) { setIndex(Number(live) || 0); setOpen(true); return; }
      setOpen(localStorage.getItem(key) !== "done" && path === "/dashboard");
    } catch { setOpen(false); }
  },[key]);
  const finish = () => { try { localStorage.setItem(key,"done"); sessionStorage.removeItem(`${key}:step`); } catch { /* guide works without storage */ } setOpen(false); };
  const go = (next: number) => { const step = steps[next]; if (!step) return; setIndex(next); try { sessionStorage.setItem(`${key}:step`, String(next)); } catch { /* ignore */ } void navigate({to:step.to}); };
  const step = steps[index];
  return <>
    <Button variant="ghost" size="icon" aria-label="Start welcome guide" title="Welcome guide" onClick={()=>{setIndex(0);setOpen(true);go(0);}}><GraduationCap className="h-5 w-5" /></Button>
    {open && step && typeof document !== "undefined" && createPortal(<aside role="dialog" aria-modal="false" aria-label="Welcome guide" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-lg border bg-card p-4 text-card-foreground shadow-lg lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[28rem]">
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Welcome · {index+1} of {steps.length}</p><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Skip welcome guide" onClick={finish}><X className="h-4 w-4" /></Button></div>
      <h2 className="mt-1 text-lg font-semibold">{step.title}</h2><p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
      <div className="mt-4 flex items-center justify-between gap-2"><label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="h-4 w-4 accent-primary" onChange={(e)=>{if(e.target.checked)finish();}} />Don't show again</label><div className="flex gap-2"><Button size="icon" variant="outline" disabled={index===0} aria-label="Previous guide step" onClick={()=>go(index-1)}><ArrowLeft className="h-4 w-4" /></Button><Button size="sm" onClick={()=>index===steps.length-1?finish():go(index+1)}>{index===steps.length-1?"Finish":"Next"}<ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>
    </aside>, document.body)}
  </>;
}