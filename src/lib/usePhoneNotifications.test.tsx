// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePhoneNotifications } from './usePhoneNotifications';
import { startSession } from './focusSession';
const auth=vi.hoisted(()=>({identity:vi.fn(),session:{user:{id:'guest'},access_token:'session-token'}}));
vi.mock('./auth',()=>({supabaseUrl:'https://project.test',supabasePublicKey:'public',tutorIdentity:auth.identity,supabase:{auth:{getSession:async()=>({data:{session:auth.session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})}}}));
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals();vi.restoreAllMocks();auth.identity.mockReset();});
it('asks permission only on a tap, schedules remotely, cancels a paused timer, and preserves drafts on failure',async()=>{
  const permission=vi.fn(async()=>{expect(auth.identity).not.toHaveBeenCalled();return 'granted';});
  vi.stubGlobal('Notification',{permission:'granted',requestPermission:permission});
  vi.stubGlobal('PushManager',class{});
  Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});
  const subscription={toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{}}),unsubscribe:vi.fn(async()=>true)};
  const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>subscription}};
  Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve(registration),getRegistration:async()=>registration},configurable:true});
  const calls:{action:string;jobs?:unknown[]}[]=[];
  vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    return Response.json(body.action==='status'?{configured:true,publicKey:'AAAA'}:{ok:true});
  }));
  auth.identity.mockResolvedValue(auth.session);
  const initial=startSession('timer',25,'Read',Date.now());
  const hook=renderHook(({session})=>usePhoneNotifications(session),{initialProps:{session:initial}});
  expect(permission).not.toHaveBeenCalled();expect(calls).toEqual([]);
  await act(async()=>{await hook.result.current.enable();});
  expect(hook.result.current.enabled).toBe(true);
  expect(calls.find(c=>c.action==='sync')?.jobs).toHaveLength(1);
  hook.rerender({session:{...initial,status:'paused'}});
  await waitFor(()=>expect(calls.filter(c=>c.action==='sync').slice(-1)[0]?.jobs).toEqual([]));
  vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('offline');}));
  await act(async()=>{await hook.result.current.sync();});
  expect(hook.result.current.syncError).toContain('could not sync');
  expect(hook.result.current.enabled).toBe(true);
});
it('keeps the feature off when permission is refused without starting anonymous authentication',async()=>{
  vi.stubGlobal('Notification',{permission:'default',requestPermission:async()=> 'denied'});vi.stubGlobal('PushManager',class{});
  Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});
  Object.defineProperty(navigator,'serviceWorker',{value:{},configurable:true});
  const hook=renderHook(()=>usePhoneNotifications(null));
  await act(async()=>{await hook.result.current.enable();});
  expect(hook.result.current.enabled).toBe(false);expect(auth.identity).not.toHaveBeenCalled();
  expect(hook.result.current.message).toContain('stayed off');
});
