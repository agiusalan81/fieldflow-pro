export function pwaRefused(production: boolean, framed: boolean, hostname: string, search: string) {
  return !production || framed || hostname.startsWith("id-preview--") || hostname.startsWith("preview--") || ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) || new URLSearchParams(search).get("sw") === "off";
}
export async function registerOfflineApp() {
  if (!("serviceWorker" in navigator)) return;
  if (pwaRefused(import.meta.env.PROD, window.self !== window.top, window.location.hostname, window.location.search)) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      if (worker && new URL(worker.scriptURL).pathname === "/sw.js") await registration.unregister();
    }
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}