// Single registration point for the app service worker. Never registers in dev/preview.
import { useEffect, useState, useSyncExternalStore } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: BIPEvent | null = null;
let needRefresh = false;
let applyUpdate: (() => void) | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

function refused() {
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = location.hostname;
  const bad = (d: string) => h === d || h.endsWith("." + d);
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (bad("lovableproject.com") || bad("lovableproject-dev.com") || bad("beta.lovable.dev")) return true;
  if (new URLSearchParams(location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.filter((r) => (r.active || r.waiting || r.installing)?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
}

let started = false;
export function initPWA() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIPEvent; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });
  if (!("serviceWorker" in navigator)) return;
  if (refused()) { void unregisterAppSW(); return; }
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
    const onWaiting = (w: ServiceWorker) => {
      needRefresh = true;
      applyUpdate = () => w.postMessage({ type: "SKIP_WAITING" });
      emit();
    };
    if (reg.waiting && navigator.serviceWorker.controller) onWaiting(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) onWaiting(w);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !needRefresh) return;
    reloaded = true;
    location.reload();
  });
}

export function useUpdateAvailable() {
  const v = useSyncExternalStore(subscribe, () => needRefresh, () => false);
  return { available: v, update: () => applyUpdate?.() };
}

export function useInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferred, () => false);
  const [env, setEnv] = useState({ standalone: false, ios: false });
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    setEnv({ standalone, ios });
  }, []);
  const install = async () => {
    if (!deferred) return;
    const d = deferred;
    await d.prompt();
    await d.userChoice.catch(() => null);
    deferred = null; emit();
  };
  return { ...env, canPrompt, install };
}
