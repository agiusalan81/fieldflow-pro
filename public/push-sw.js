// Dedicated messaging worker. Also supports existing offline-worker subscriptions.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    // Always display a received push: phones can retain a stale focused window
    // while locked, and silent pushes violate userVisibleOnly on some browsers.
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch (e) {
      try { d = { body: event.data && event.data.text() }; } catch (e2) { d = {}; }
    }
    if (!d || typeof d !== "object") d = {};
    const title = (typeof d.title === "string" && d.title.trim()) || "FieldBridge";
    const body = (typeof d.body === "string" && d.body.trim()) || "You have a new team chat message";
    const data = d.data && typeof d.data === "object" ? d.data : {};
    if (!data.url) data.url = d.url || "/messages";
    await self.registration.showNotification(title, {
      body, icon: d.icon || "/icon-192x192.png", badge: d.badge || "/badge-72x72.png", data,
      tag: d.tag || (data.chatId ? `chat:${data.chatId}` : "fb-chat"), renotify: true,
      vibrate: [200, 100, 200], timestamp: Date.now(), requireInteraction: false,
    });
  })());
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/messages", self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of open) {
      if ("focus" in c) { const f = await c.focus(); if ("navigate" in (f || c)) await (f || c).navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
