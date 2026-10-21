import { getPushPublicKey, savePushSubscription, sendChatPush } from "@/lib/web-push.functions";

const toKey = (s: string) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const b64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export type PushStatus = "unsupported" | "blocked" | "needs-permission" | "no-worker" | "registered" | "error";

/** Waits for the app worker; mobile can take a while on first launch. */
async function workerReady(ms = 20000): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/** Registers this device for closed-app chat alerts and reports what happened. */
export async function registerPush(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "needs-permission";
  try {
    const reg = await workerReady();
    if (!reg) return "no-worker";
    let sub = await reg.pushManager.getSubscription();
    const { key } = await getPushPublicKey();
    const want = toKey(key);
    const cur = sub?.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    if (sub && cur && (cur.length !== want.length || cur.some((v, i) => v !== want[i]))) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
    await savePushSubscription({ data: { endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) } });
    return "registered";
  } catch (e) {
    console.error("push registration failed", e);
    return "error";
  }
}

/** Asks for permission (must be called from a tap), then registers. */
export async function enablePush(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "default") await Notification.requestPermission();
  return registerPush();
}

export async function ensurePushSubscription(): Promise<boolean> {
  return (await registerPush()) === "registered";
}

/** Best-effort: never blocks or fails the message send. */
export function pushChatMessages(ids: string[]) {
  if (ids.length) void sendChatPush({ data: { messageIds: ids } }).catch(() => undefined);
}
