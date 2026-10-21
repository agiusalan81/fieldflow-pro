import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });
}

export const OFFER_INSTALL_KEY = "fb.offer-install";

export function useInstallApp() {
  const [, tick] = useState(0);
  const [env, setEnv] = useState({ mobile: false, ios: false, installed: false });
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setEnv({ mobile: ios || /Android|Mobi|Tablet/i.test(ua), ios, installed });
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    ...env,
    canPrompt: !!deferred,
    show: env.mobile && !env.installed,
    install: async () => { if (!deferred) return false; await deferred.prompt(); const r = await deferred.userChoice; deferred = null; return r.outcome === "accepted"; },
  };
}
