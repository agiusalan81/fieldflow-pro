import { afterEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({ getPushPublicKey: vi.fn(), savePushSubscription: vi.fn(), sendChatPush: vi.fn() }));
vi.mock("@/lib/web-push.functions", () => rpc);
import { currentPushEndpoint, enablePush, readPushStatus, registerPush } from "./web-push";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

function device(permission = "granted") {
  const key = new Uint8Array([4, 1, 2]).buffer;
  const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/test", options: { applicationServerKey: key }, getKey: () => new Uint8Array([1, 2, 3]).buffer };
  const reg = { active: {}, pushManager: { getSubscription: vi.fn().mockResolvedValue(sub), subscribe: vi.fn() } };
  const register = vi.fn().mockResolvedValue(reg);
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register, getRegistration: vi.fn().mockResolvedValue(reg) } });
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission });
  rpc.getPushPublicKey.mockResolvedValue({ key: "BAEC" });
  rpc.savePushSubscription.mockResolvedValue({ ok: true });
  return { register, sub, reg };
}

it("registers a dedicated messaging worker without waiting for the offline worker", async () => {
  const { register, sub } = device();
  expect(await registerPush()).toBe("registered");
  expect(register).toHaveBeenCalledWith("/push-sw.js", { scope: "/push/", updateViaCache: "none" });
  expect(rpc.savePushSubscription).toHaveBeenCalledWith({ data: { endpoint: sub.endpoint, p256dh: "AQID", auth: "AQID" } });
  expect(await currentPushEndpoint()).toBe(sub.endpoint);
});

it("coalesces simultaneous registration calls instead of racing subscriptions", async () => {
  const { register } = device();
  expect(await Promise.all([registerPush(), registerPush(), registerPush()])).toEqual(["registered", "registered", "registered"]);
  expect(register).toHaveBeenCalledTimes(1);
});

it("does not claim registration when saving the current account fails", async () => {
  device(); vi.spyOn(console, "error").mockImplementation(() => undefined);
  rpc.savePushSubscription.mockRejectedValue(new Error("not saved"));
  expect(await registerPush()).toBe("error");
});

it("does not subscribe a device with denied permission", async () => {
  const { register } = device("denied");
  expect(await registerPush()).toBe("blocked");
  expect(register).not.toHaveBeenCalled();
});
it('returns an honest error when the browser permission request rejects', async () => {
  device('default');
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockRejectedValue(new Error('Browser refused')) });
  expect(await enablePush()).toBe('error');
});

it("re-syncs an existing subscription without subscribing again", async () => {
  const { reg, sub } = device();
  expect(await registerPush()).toBe("registered");
  expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
  expect(rpc.savePushSubscription).toHaveBeenCalledWith({ data: { endpoint: sub.endpoint, p256dh: "AQID", auth: "AQID" } });
});

it("subscribes with userVisibleOnly when no subscription exists", async () => {
  const { reg, sub } = device();
  reg.pushManager.getSubscription.mockResolvedValue(null);
  reg.pushManager.subscribe.mockResolvedValue(sub);
  expect(await registerPush()).toBe("registered");
  expect(reg.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: new Uint8Array([4, 1, 2]) });
  expect(rpc.savePushSubscription).toHaveBeenCalledTimes(1);
});
it('quietly checks the current subscription without registering or sending a server request', async () => {
  const { register, reg } = device();
  expect(await readPushStatus()).toBe('registered');
  expect(register).not.toHaveBeenCalled();
  expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
  expect(rpc.savePushSubscription).not.toHaveBeenCalled();
  reg.pushManager.getSubscription.mockResolvedValue(null);
  expect(await readPushStatus()).toBe('no-worker');
});
it('reports revoked notification permission even with a previously registered subscription', async () => {
  device('denied');
  expect(await readPushStatus()).toBe('blocked');
});