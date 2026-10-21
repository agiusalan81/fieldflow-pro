// Loaded into the app service worker: shows chat alerts when the app is closed.
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // The open app already shows its own banner.
    if (open.some((c) => c.visibilityState === "visible")) return;
    await self.registration.showNotification("FieldBridge", { body: "You have a new team chat message", icon: "/app-icon-192.png", badge: "/app-icon-192.png", tag: "fb-chat", renotify: true, data: { url: "/messages" } });
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
