// Exercise push display and click navigation; the browser owns permission and transport.
import { afterEach, expect, it, vi } from 'vitest';
const workbox=vi.hoisted(()=>({precache:vi.fn(),route:vi.fn()}));
vi.mock('workbox-precaching',()=>({cleanupOutdatedCaches:vi.fn(),precacheAndRoute:workbox.precache,createHandlerBoundToURL:vi.fn()}));
vi.mock('workbox-routing',()=>({registerRoute:workbox.route,NavigationRoute:class {}}));
vi.mock('workbox-strategies',()=>({CacheFirst:class {}}));
vi.mock('workbox-expiration',()=>({ExpirationPlugin:class {}}));
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();vi.clearAllMocks();});
it('displays push payloads and focuses an existing app without trusting a supplied URL',async()=>{
  const listeners=new Map<string,(e:unknown)=>void>();
  const show=vi.fn().mockResolvedValue(undefined),focus=vi.fn(),post=vi.fn(),open=vi.fn();
  vi.stubGlobal('self',{__WB_MANIFEST:[],location:{origin:'https://i0kyung.github.io'},registration:{scope:'https://i0kyung.github.io/moodee/',showNotification:show},clients:{claim:vi.fn(),matchAll:async()=>[{url:'https://i0kyung.github.io/moodee/',focus,postMessage:post}],openWindow:open},addEventListener:(name:string,handler:(e:unknown)=>void)=>listeners.set(name,handler)});
  await import('./sw');
  let pending:Promise<unknown>=Promise.resolve();
  const waitUntil=(p:Promise<unknown>)=>{pending=p;};
  listeners.get('push')!({data:{json:()=>({title:'Break over',body:'Return',id:'b',destination:'classroom',url:'https://evil.test'})},waitUntil});
  await pending;
  expect(show).toHaveBeenCalledWith('Break over',expect.objectContaining({tag:'b',data:{destination:'classroom'}}));
  listeners.get('notificationclick')!({notification:{close:vi.fn(),data:{destination:'classroom',url:'https://evil.test'}},waitUntil});
  await pending;
  expect(post).toHaveBeenCalledWith({type:'OPEN_SCREEN',destination:'classroom'});
  expect(focus).toHaveBeenCalledOnce();expect(open).not.toHaveBeenCalled();
});
it('uses app scope for a closed-window notification and ignores an arbitrary destination',async()=>{
  const listeners=new Map<string,(e:unknown)=>void>();const open=vi.fn();
  vi.stubGlobal('self',{__WB_MANIFEST:[],location:{origin:'https://i0kyung.github.io'},registration:{scope:'https://i0kyung.github.io/moodee/'},clients:{claim:vi.fn(),matchAll:async()=>[],openWindow:open},addEventListener:(name:string,handler:(e:unknown)=>void)=>listeners.set(name,handler)});
  await import('./sw');let pending:Promise<unknown>=Promise.resolve();
  listeners.get('notificationclick')!({notification:{close:vi.fn(),data:{destination:'https://evil.test'}},waitUntil:(p:Promise<unknown>)=>{pending=p;}});
  await pending;expect(open).toHaveBeenCalledWith('https://i0kyung.github.io/moodee/?open=calendar');
});
