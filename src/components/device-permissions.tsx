import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Bell, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pushSupported, readPushStatus, registerPush, type PushStatus } from '@/lib/web-push';
import { boundedPermission, permissionSequence } from '@/lib/permission-sequence';
import { useProfile } from '@/lib/profile';
import { isMobileDevice } from '@/lib/testing-rules';
import { dismissSetup, setupDismissed } from '@/lib/device-setup';
import { confirmFieldLocation, fieldDeviceReady, locationDeviceConfirmed, readLocationPermission, requiresFieldDevice, type GeoStatus } from '@/lib/field-device';
import { ShiftSignOut } from '@/components/shift-sign-out';
import { ReturnToSuperuserBanner } from '@/components/test-session-switch';
const RecoveryShift = lazy(() => import('@/routes/_authenticated/dashboard').then(m => ({ default: m.ShiftTracker })));

/** Field setup cannot be dismissed; office setup remains optional. No shift is started here. */
export function DevicePermissions({ children }: { children: ReactNode }) {
  const { data: profile, isLoading, error } = useProfile();
  const field = requiresFieldDevice(profile?.real_role, profile?.can_field_dispatch);
  const [mobile, setMobile] = useState(false);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [geo, setGeo] = useState<GeoStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let active = true;
    setMobile(isMobileDevice(navigator.userAgent) && navigator.maxTouchPoints > 0);
    setPush(null); setGeo(null); setRecovery(false);
    if (!profile) return;
    setLater(setupDismissed(profile.id));
    let refreshing = false;
    const refresh = async (initial = false) => {
      if (refreshing) return;
      refreshing = true;
      try {
        const [localPush, permission] = await Promise.all([readPushStatus(), readLocationPermission()]);
        // Link on account entry only. A temporary network failure is not a revoked device permission.
        const linked = initial && localPush === 'registered' ? await boundedPermission(registerPush, 25000) : localPush;
        const p = localPush === 'registered' && (!linked || linked === 'error') ? localPush : linked;
        // A previous successful GPS fix remains confirmed while the browser grant is valid.
        // Fresh GPS is still required by the shared clock-in workflow, not every focus event.
        const g = field && permission === 'granted' && !locationDeviceConfirmed()
          ? await confirmFieldLocation(profile.id) : permission;
        if (active) {
          if (p !== 'error' || initial) setPush(p ?? 'error');
          setGeo(g);
        }
      } finally { refreshing = false; }
    };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh(true);
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    const timer = setInterval(visible, 60000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [profile?.id, field]);
  const check = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const [p, permission] = await Promise.all([boundedPermission(registerPush, 25000), readLocationPermission()]);
      setPush(p ?? 'error');
      setGeo(field && permission === 'granted' ? await confirmFieldLocation(profile.id) : permission);
    } finally { setBusy(false); }
  };
  const allow = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await permissionSequence(async () => {
        if (pushSupported() && Notification.permission === 'default') return Notification.requestPermission();
        return 'complete';
      }, async () => {
        if (field) setGeo(await confirmFieldLocation(profile.id));
      });
      setPush((await boundedPermission(registerPush, 25000)) ?? 'error');
    } finally { setBusy(false); }
  };
  if (isLoading || (field && (push === null || geo === null))) return <div role="status" className="p-6 text-muted-foreground">Checking device permissions…</div>;
  if (error) return <div role="alert" className="p-6 text-destructive">Could not check your account. Reload to try again.</div>;
  if (!profile) return children;
  const pushOk = field ? push === 'registered' : push === 'registered' || push === 'unsupported';
  const geoOk = !field || geo === 'granted';
  const open = field ? !fieldDeviceReady(push, geo) : mobile && !later && !pushOk;
  const blocked = push === 'blocked' || geo === 'denied';
  const row = (icon: ReactNode, label: string, ok: boolean, denied: boolean) => <div className="flex items-center gap-3 border-b py-3">{icon}<p className="text-sm font-medium">{label} — {ok ? 'On' : denied ? 'Blocked' : 'Not on yet'}</p></div>;
  return <>
    {(!field || !open) && children}
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto [&>button]:hidden" onEscapeKeyDown={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>Set up this device</DialogTitle><DialogDescription>{field ? 'Enable notifications and location before starting field work. Location is shared only during eligible clocked-in shifts; browser sleep can interrupt tracking.' : 'Enable notifications for job and team alerts.'}</DialogDescription></DialogHeader>
        {row(<Bell className="h-4 w-4 shrink-0" />, 'Notifications', pushOk, push === 'blocked')}
        {field && row(<MapPin className="h-4 w-4 shrink-0" />, 'Location', geoOk, geo === 'denied')}
        {blocked && <p className="text-sm text-muted-foreground">Allow notifications and location in this site's browser settings, then check again.</p>}
        {push === 'unsupported' && field && <p role="alert" className="text-sm text-muted-foreground">This browser cannot receive push notifications. On iPhone or iPad, add the app to your Home Screen and open it there; otherwise use a push-supported browser.</p>}
        {geo === 'unsupported' && field && <p role="alert" className="text-sm text-destructive">This device cannot provide location. Use a location-enabled device.</p>}
        {geo === 'unavailable' && <p role="alert" className="text-sm text-muted-foreground">No GPS fix yet. Turn on device location, move to a clearer signal and retry.</p>}
        {(push === 'error' || push === 'no-worker') && <p role="alert" className="text-sm text-muted-foreground">Notifications could not be connected. Check your connection and retry.</p>}
        <div className="flex flex-col gap-2">
          <Button className="h-11" disabled={busy} onClick={allow}>{busy ? 'Checking permissions…' : 'Enable notifications & location'}</Button>
          <Button variant="outline" className="h-11" disabled={busy} onClick={check}><RefreshCw className="mr-2 h-4 w-4" />Check again</Button>
          {!field && <Button variant="ghost" onClick={() => { dismissSetup(profile.id); setLater(true); }}>Continue without setup</Button>}
          {field && <>
            <Button variant="ghost" onClick={() => setRecovery(v => !v)}>Clock-out options</Button>
            {recovery && <Suspense fallback={<p role="status">Loading your shift…</p>}><RecoveryShift profile={profile} recoveryOnly /></Suspense>}
            <ShiftSignOut userId={profile.id} onClockOut={() => setRecovery(true)} />
            <ReturnToSuperuserBanner />
          </>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
