import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enablePush, registerPush, type PushStatus } from "@/lib/web-push";
import { sendTestPush } from "@/lib/web-push.functions";
import { InstallAppCard } from "@/components/install-app";

const LABEL: Record<PushStatus | "checking", string> = {
  checking: "Checking this device…",
  unsupported: "This browser can't show lock-screen alerts. On iPhone, install the app to your home screen first.",
  blocked: "Notifications are blocked for FieldBridge. Allow them in your phone's browser or app settings.",
  "needs-permission": "Notifications are not switched on yet.",
  "no-worker": "The app isn't ready on this device yet. Open the installed app (not the editor preview) and try again.",
  registered: "This device will get chat alerts on the lock screen.",
  error: "Couldn't register this device. Try again.",
};

export function PushDeviceStatus() {
  const [s, setS] = useState<PushStatus | "checking">("checking");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void registerPush().then(setS); }, []);
  const enable = async () => { setBusy(true); setS(await enablePush()); setBusy(false); };
  const test = async () => {
    setBusy(true);
    try {
      const r = await sendTestPush();
      if (!r.devices) toast.error("No devices registered for your account yet.");
      else if (!r.sent) { setS(await registerPush()); toast.error("No device accepted the test alert. Turn notifications on again on your phone, then retry."); }
      else toast.success(`Test sent to ${r.sent} of ${r.devices} device(s). Lock your phone to see it.`);
    } catch { toast.error("Couldn't send a test alert."); }
    setBusy(false);
  };
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-medium text-foreground"><Bell className="h-4 w-4" />Notifications on this device</h2>
      <p className="text-sm text-muted-foreground">{LABEL[s]}</p>
      <div className="flex flex-wrap gap-2">
        {s !== "registered" && s !== "unsupported" && <Button className="h-11" disabled={busy} onClick={enable}>Turn on notifications</Button>}
        {s === "registered" && <Button variant="outline" className="h-11" disabled={busy} onClick={test}>Send test alert</Button>}
      </div>
      <InstallAppCard compact />
    </section>
  );
}
