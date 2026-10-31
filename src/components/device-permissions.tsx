import { useEffect, useState } from "react";
import { Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pushSupported, registerPush, type PushStatus } from "@/lib/web-push";
import { boundedPermission, permissionSequence } from '@/lib/permission-sequence';
import { useProfile } from "@/lib/profile";
import { isMobileDevice } from '@/lib/testing-rules';
import { usePlanFeatures } from '@/lib/plan-features';
import { dismissSetup, setupDismissed } from '@/lib/device-setup';

type Geo = "granted" | "denied" | "prompt" | "unsupported";
async function geoState(): Promise<Geo> {
  if (!("geolocation" in navigator)) return "unsupported";
  try { return (await navigator.permissions.query({ name: "geolocation" })).state as Geo; } catch { return "prompt"; }
}

/** Bundled first-run permission setup: notifications for everyone, location for field staff. */
export function DevicePermissions() {
  const { data: profile } = useProfile();
  const on = usePlanFeatures(!!profile);
  const [mobile, setMobile] = useState(false);
  const field = on('tracking') && !!profile && ['technician','supervisor','maintenance'].includes(profile.real_role);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false);
  const check = async () => { setBusy(true); try { const [p, g] = await Promise.all([boundedPermission(registerPush), boundedPermission(geoState)]); setPush(p ?? 'error'); setGeo(g ?? 'prompt'); } finally { setBusy(false); } };
  useEffect(() => {
    let active = true;
    const phone = isMobileDevice(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 0;
    setMobile(phone); setPush(null); setGeo(null);
    if (!phone || !profile) return;
    setLater(setupDismissed(profile.id));
    const refresh = async () => { const [p, g] = await Promise.all([boundedPermission(registerPush), boundedPermission(geoState)]); if (active) { setPush(p ?? 'error'); setGeo(g ?? 'prompt'); } };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh(); window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [profile?.id]);
  if (!mobile || !profile || push === null || geo === null) return null;
  const pushOk = push === "registered" || push === "unsupported";
  const geoOk = !field || geo === "granted" || geo === "unsupported";
  const blocked = push === "blocked" || (field && geo === "denied");
  const open = !later && !(pushOk && geoOk);

  // Notifications start in the tap; location waits until that browser prompt finishes.
  const allow = async () => {
    setBusy(true);
    try {
      await permissionSequence(async () => {
        if (pushSupported() && Notification.permission === 'default') return Notification.requestPermission();
        return 'complete';
      }, async () => {
        if (!field || geo === 'granted' || geo === 'denied' || geo === 'unsupported') return;
        await new Promise<void>(resolve => {
          navigator.geolocation.getCurrentPosition(() => { setGeo('granted'); resolve(); }, error => {
            setGeo(error.code === 1 ? 'denied' : 'prompt'); resolve();
          }, { timeout: 5000, maximumAge: 600000 });
        });
      });
      const p = await boundedPermission(registerPush);
      setPush(p ?? 'error');
    } finally { setBusy(false); }
  };

  const Row = ({ icon, label, why, ok, bad }: { icon: React.ReactNode; label: string; why: string; ok: boolean; bad: boolean }) => (
    <div className="flex gap-3 rounded-lg border p-3">
      {icon}
      <div className="text-sm"><p className="font-medium text-foreground">{label} — {ok ? "On" : bad ? "Blocked" : "Not on yet"}</p><p className="text-muted-foreground">{why}</p></div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="[&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set up this device</DialogTitle>
          <DialogDescription>FieldBridge needs these to alert you about jobs and keep your shift records accurate.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Row icon={<Bell className="mt-0.5 h-4 w-4" />} label="Notifications" why="Lock-screen alerts for dispatched jobs, rota changes and team chat." ok={pushOk} bad={push === "blocked"} />
          {field && <Row icon={<MapPin className="mt-0.5 h-4 w-4" />} label="Location" why="Used only while you're clocked in, for travel and arrival times." ok={geoOk} bad={geo === "denied"} />}
        </div>
        {blocked && <p className="text-sm text-muted-foreground">{mobile ? "Open your phone's app or browser permissions and allow notifications/location, then tap Check again." : "Open the site controls beside the browser address and review Notifications and Location. Private browsing can block notifications; you can continue without them."}</p>}
        <div className="flex flex-col gap-2">
          {blocked && <Button className="h-11" variant="outline" disabled={busy} onClick={check}>Check again</Button>}
          {(!pushOk && push !== 'blocked' || !geoOk && geo !== 'denied') && <Button className="h-11" disabled={busy} onClick={allow}>{busy ? 'Checking permissions…' : pushOk || push === 'blocked' ? 'Allow location' : 'Allow all'}</Button>}
          <Button variant="ghost" className="h-11" onClick={() => { dismissSetup(profile.id); setLater(true); }}>Continue without setup</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
