import { getPushPublicKey, savePushSubscription, sendChatPush } from "@/lib/web-push.functions";

const toKey = (s: string) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const b64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Registers this device for closed-app chat alerts. Returns false when the installed app's worker isn't available (e.g. editor preview). */
export async function ensurePushSubscription(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
  if (!reg) return false;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { key } = await getPushPublicKey();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
  }
  await savePushSubscription({ data: { endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) } });
  return true;
}

/** Best-effort: never blocks or fails the message send. */
export function pushChatMessages(ids: string[]) {
  if (ids.length) void sendChatPush({ data: { messageIds: ids } }).catch(() => undefined);
}
