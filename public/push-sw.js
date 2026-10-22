// Loaded into the app service worker: shows chat alerts when the app is closed.
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // The open app already shows its own banner (only when actually focused on screen).
    if (open.some((c) => c.visibilityState === "visible" && c.focused)) return;
    let a = {};
    try { a = event.data ? event.data.json() : {}; } catch (e) { a = {}; }
    await self.registration.showNotification(a.title || "FieldBridge", { body: a.body || "You have a new team chat message", icon: "/app-icon-192.png", badge: "/app-icon-192.png", tag: a.tag || "fb-chat", renotify: true, vibrate: [200, 100, 200], timestamp: Date.now(), requireInteraction: false, data: { url: a.url || "/messages" } });
  })());
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/messages";
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of open) { if ("focus" in c) { await c.focus(); if ("navigate" in c) await c.navigate(url); return; } }
    await self.clients.openWindow(url);
  })());
});
