/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: {url:string;revision:string|null}[] };
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/\?(?:.*&)?(?:code|error|oauth_destination)=/] }));
registerRoute(({url,request}) => url.origin === self.location.origin && url.pathname.includes('/assets/') && ['image','audio'].includes(request.destination),
  new CacheFirst({cacheName:'moodee-world-v1',plugins:[new ExpirationPlugin({maxEntries:150,maxAgeSeconds:30*86400,purgeOnQuotaError:true})]}));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('push', event => {
  let data: Record<string,unknown> = {};
  try { data = event.data?.json() ?? {}; } catch { /* Display a fallback for malformed payloads. */ }
  const destination = data.destination === 'classroom' ? 'classroom' : 'calendar';
  event.waitUntil(self.registration.showNotification(typeof data.title === 'string' ? data.title.slice(0,100) : 'MOODEE', {
    body: typeof data.body === 'string' ? data.body.slice(0,240) : 'A little space for your plans.',
    icon: new URL('assets/brand/icon-192.png',self.registration.scope).href,
    tag: typeof data.id === 'string' ? data.id : 'moodee-reminder', data: {destination},
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = event.notification.data?.destination === 'classroom' ? 'classroom' : 'calendar';
  const url = new URL(`?open=${destination}`,self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client = windows.find(c => c.url.startsWith(self.registration.scope));
    if (client) { client.postMessage({type:'OPEN_SCREEN',destination}); await client.focus(); }
    else await self.clients.openWindow(url);
  })());
});
