import { getPushPublicKey, savePushSubscription, sendChatPush } from "@/lib/web-push.functions";

const toKey = (s: string) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
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

export async function currentPushEndpoint(): Promise<string | undefined> {
  if (!pushSupported()) return undefined;
  const reg = await navigator.serviceWorker.getRegistration("/push/");
  return (await reg?.pushManager.getSubscription())?.endpoint;
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
  if (ids.length) void sendChatPush({ data: { messageIds: ids } }).catch(() => console.error("Chat saved, but its phone alert could not be sent."));
}
