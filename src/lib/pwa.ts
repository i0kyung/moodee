import { registerSW } from 'virtual:pwa-register';
let update: ((reloadPage?: boolean) => Promise<void>) | undefined;
let waiting = false;
export function updateAvailable() { return waiting; }
export function applyUpdate() { return update?.(true); }
export function registerPwa() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  update = registerSW({
    immediate:true,
    onNeedRefresh() { waiting=true; window.dispatchEvent(new Event('moodee:pwa-update')); },
    onRegisteredSW(_url,registration) {
      if (!registration) return;
      const check = () => { if (navigator.onLine) void registration.update().catch(() => {}); };
      window.addEventListener('focus',check); window.setInterval(check, 3600000);
    },
  });
}
