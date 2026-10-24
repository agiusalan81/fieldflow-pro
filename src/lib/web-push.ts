import { getPushPublicKey, savePushSubscription, sendChatPush } from "@/lib/web-push.functions";

/** Converts a URL-safe base64 VAPID public key into the bytes pushManager.subscribe expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const raw = atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const b64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export type PushStatus = "unsupported" | "blocked" | "needs-permission" | "no-worker" | "registered" | "error";

/** Messaging has its own registration; offline caching must not gate alerts. */
async function workerReady(ms = 20000): Promise<ServiceWorkerRegistration | null> {
  const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/push/", updateViaCache: "none" });
  if (reg.active) return reg;
  const worker = reg.installing ?? reg.waiting;
  if (!worker) return null;
  return new Promise((resolve) => {
    const finish = (value: ServiceWorkerRegistration | null) => {
      clearTimeout(timer); worker.removeEventListener("statechange", changed); resolve(value);
    };
    const changed = () => {
      if (worker.state === "activated") finish(reg);
      else if (worker.state === "redundant") finish(null);
    };
    const timer = setTimeout(() => finish(null), ms);
    worker.addEventListener("statechange", changed);
    changed();
  });
}

/** Registers this device for closed-app chat alerts and reports what happened. */
let registering: Promise<PushStatus> | undefined;
export function registerPush(): Promise<PushStatus> {
  if (!registering) registering = registerDevice().finally(() => { registering = undefined; });
  return registering;
}
async function registerDevice(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "needs-permission";
  try {
    const reg = await workerReady();
    if (!reg) return "no-worker";
    const { key: VAPID_PUBLIC_KEY } = await getPushPublicKey();
    const want = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    // Reuse an existing subscription when it was made with the current key; just re-sync it.
    let sub = await reg.pushManager.getSubscription();
    const cur = sub?.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    if (sub && cur && (cur.length !== want.length || cur.some((v, i) => v !== want[i]))) { await sub.unsubscribe(); sub = null; }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource });
    }
    // Server binds the row to the verified signed-in user_id.
    await savePushSubscription({ data: { endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) } });
    return "registered";
  } catch (e) {
    console.error("push registration failed", e);
    return "error";
  }
}

/** Re-links this browser's existing subscription to whoever is signed in (any sign-in method). */
let lastLinked: string | undefined;
export async function linkPushToUser(userId: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/push/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) { void registerPush(); return; }
    const key = `${userId}|${sub.endpoint}`;
    if (lastLinked === key) return;
    await savePushSubscription({ data: { endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) } });
    lastLinked = key;
  } catch (e) { console.error("push link failed", e); }
}

export async function currentPushEndpoint(): Promise<string | undefined> {
  if (!pushSupported()) return undefined;
  const reg = await navigator.serviceWorker.getRegistration("/push/");
  return (await reg?.pushManager.getSubscription())?.endpoint;
}

/** Asks for permission (must be called from a tap), then registers. */
export async function enablePush(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  try {
    if (Notification.permission === "default") await Notification.requestPermission();
    return await registerPush();
  } catch { return "error"; }
}

export async function ensurePushSubscription(): Promise<boolean> {
  return (await registerPush()) === "registered";
}

/** Best-effort: never blocks or fails the message send. */
export function pushChatMessages(ids: string[]) {
  if (ids.length) void sendChatPush({ data: { messageIds: ids } }).catch(() => console.error("Chat saved, but its phone alert could not be sent."));
}
