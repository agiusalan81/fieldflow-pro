import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { currentPushEndpoint, enablePush, registerPush, type PushStatus } from "@/lib/web-push";
import { sendTestPush } from "@/lib/web-push.functions";
import { InstallAppCard } from "@/components/install-app";

const LABEL: Record<PushStatus | "checking", string> = {
  checking: "Checking this device…",
  unsupported: "This browser can't show lock-screen alerts. On iPhone, install the app to your home screen first.",
  blocked: "Notifications are blocked for FieldBridge. Allow them in your phone's browser or app settings.",
  "needs-permission": "Notifications are not switched on yet.",
  "no-worker": "Notification setup timed out. Check your connection and try again.",
  registered: "This device is registered for your account. Send a test to check phone delivery.",
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
      const status = await registerPush(); setS(status);
      const endpoint = status === "registered" ? await currentPushEndpoint() : undefined;
      if (!endpoint) { toast.error("This phone isn't registered. Turn on notifications and retry."); return; }
      toast.info("Lock your phone now. The test alert sends in 8 seconds.");
      const r = await sendTestPush({ data: { endpoint, delaySeconds: 8 } });
      if (!r.devices) toast.error("This phone's registration wasn't saved for your account. Turn notifications on again.");
      else if (!r.sent) { setS("error"); toast.error("The notification service rejected this phone's test. Turn notifications on again, then retry."); }
      else toast.success("The notification service accepted this phone's test. If nothing appeared, check Android notification and lock-screen settings for FieldBridge.");
    } catch { toast.error("Couldn't send a test alert."); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-medium text-foreground"><Bell className="h-4 w-4" />Notifications on this device</h2>
      <p className="text-sm text-muted-foreground">{LABEL[s]}</p>
      <div className="flex flex-wrap gap-2">
        {s !== "unsupported" && <Button variant={s === "registered" ? "ghost" : "default"} className="h-11" disabled={busy} onClick={enable}>{s === "registered" ? "Refresh registration" : "Turn on notifications"}</Button>}
        {s === "registered" && <Button variant="outline" className="h-11" disabled={busy} onClick={test}>Send test alert</Button>}
      </div>
      <InstallAppCard compact />
    </section>
  );
}
