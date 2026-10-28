import { useEffect, useState } from "react";
import { Snowflake, Camera, Send, Bell, MapPin, Clock, CheckCircle2, FileText, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { who: "Store staff", icon: Smartphone, title: "Scan the QR code on Chiller C-12", text: "Outlet #3 · Main Superstore. No login needed — the code already knows the store and the equipment.", action: "Scan QR code" },
  { who: "Store staff", icon: Camera, title: "Report the problem", text: "“Dairy chiller reading +9°C, ice on the coil.” Photo attached, marked as cold-chain urgent.", action: "Send report" },
  { who: "Maintenance manager", icon: Bell, title: "Urgent alert arrives", text: "Refrigeration fault at Outlet #3. Suggested technician: Mark B. (refrigeration skill, 4 km away, clocked in).", action: "Dispatch Mark" },
  { who: "Technician", icon: MapPin, title: "Clock in & travel", text: "Mark is clocked in since 07:02. Location is shared only while on shift. Arrival on site is recorded at 09:41.", action: "Arrive on site" },
  { who: "Technician", icon: Snowflake, title: "Fix and sign off", text: "Defrost cycle reset, evaporator fan replaced. Part taken from van stock, photos added, store manager signs on the phone.", action: "Complete job" },
  { who: "Maintenance manager", icon: FileText, title: "Daily Work Report ready", text: "Shift 07:02–15:30 · 3 jobs · 7.5 h · 1 part used. Ready for review and approval.", action: "Restart demo" },
] as const;

export function AisleOpsDemo() {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const step = STEPS[i]!;
  useEffect(() => { setBusy(false); }, [i]);
  const next = () => { setBusy(true); setTimeout(() => setI((n) => (n + 1) % STEPS.length), 500); };
  const managerView = step.who === "Maintenance manager";
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <ol className="space-y-2">
        {STEPS.map((s, n) => (
          <li key={s.title}>
            <button type="button" onClick={() => setI(n)} className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition ${n === i ? "border-primary bg-primary/10" : "border-border bg-card"} ${n < i ? "opacity-70" : ""}`}>
              {n < i ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{n + 1}</span>}
              <span><span className="block text-xs uppercase tracking-wide text-muted-foreground">{s.who}</span><span className="font-semibold">{s.title}</span></span>
            </button>
          </li>
        ))}
      </ol>
      <div className={`mx-auto w-full ${managerView ? "max-w-lg" : "max-w-xs"} rounded-[1.5rem] border-4 border-foreground bg-background p-4 shadow-xl transition-all`}>
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">{managerView ? <Monitor className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}{step.who}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Step {i + 1}/{STEPS.length}</span>
        </div>
        <div className="rounded-lg bg-primary p-4 text-primary-foreground">
          <step.icon className="h-8 w-8" />
          <h3 className="mt-2 font-display text-lg font-bold">{step.title}</h3>
        </div>
        <p className="mt-3 min-h-24 text-sm">{step.text}</p>
        <Button className="mt-3 w-full" onClick={i === STEPS.length - 1 ? () => setI(0) : next} disabled={busy}>
          {busy ? "Working…" : <><Send className="mr-2 h-4 w-4" />{step.action}</>}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Demo with sample data — nothing is sent.</p>
      </div>
    </div>
  );
}
