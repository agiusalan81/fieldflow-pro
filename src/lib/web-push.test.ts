import { afterEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({ getPushPublicKey: vi.fn(), savePushSubscription: vi.fn(), sendChatPush: vi.fn() }));
vi.mock("@/lib/web-push.functions", () => rpc);
import { currentPushEndpoint, registerPush } from "./web-push";

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