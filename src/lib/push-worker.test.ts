import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

it("shows a received chat push even if a locked phone retains a focused window", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const notifications: unknown[] = [];
  runInNewContext(readFileSync("public/push-sw.js", "utf8"), { self: {
    addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    clients: { matchAll: async () => [{ visibilityState: "visible", focused: true }] },
    registration: { showNotification: async (title: string, options: unknown) => { notifications.push({title, options}); } },
  }, Date });
  let pending: Promise<void> | undefined;
  handlers["push"]?.({ data: { json: () => ({title: "Teammate", body: "Hello", url: "/messages?thread=user%3A123"}) }, waitUntil: (task: Promise<void>) => { pending = task; } });
  await pending;
  expect(notifications).toHaveLength(1);
  expect(notifications[0]).toMatchObject({ title: "Teammate", options: { body: "Hello", data: { url: "/messages?thread=user%3A123" } } });
});
it("never shows a blank alert for unreadable data and opens the chat on tap", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const notifications: { title: string; options: { body: string } }[] = [];
  const opened: string[] = [];
  runInNewContext(readFileSync("public/push-sw.js", "utf8"), { self: {
    addEventListener: (n: string, h: (e: unknown) => void) => { handlers[n] = h; },
    location: { origin: "https://fieldbridgeapp.com" },
    clients: { matchAll: async () => [], openWindow: async (u: string) => { opened.push(u); } },
    registration: { showNotification: async (title: string, options: { body: string }) => { notifications.push({ title, options }); } },
  }, Date, URL });
  let p: Promise<void> | undefined;
  handlers["push"]?.({ data: { json: () => { throw new Error("bad"); }, text: () => "" }, waitUntil: (t: Promise<void>) => { p = t; } });
  await p;
  expect(notifications[0]).toMatchObject({ title: "FieldBridge", options: { body: "New message" } });
  handlers["notificationclick"]?.({ notification: { close() {}, data: { url: "/messages?thread=x", chatId: "x" } }, waitUntil: (t: Promise<void>) => { p = t; } });
  await p;
  expect(opened).toEqual(["https://fieldbridgeapp.com/messages?thread=x"]);
});
