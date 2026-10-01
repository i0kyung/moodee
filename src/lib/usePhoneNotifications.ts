import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, supabasePublicKey, supabaseUrl, tutorIdentity } from './auth';
import { guestPlans } from './calendar';
import type { FocusSession } from './focusSession';
import { pushSchedule } from './pushSchedule';
import { loadValue, save } from './storage';

interface Device {id:string;owner:string;version:number}
export function installedPwa() { return Boolean(window.matchMedia?.('(display-mode: standalone)').matches) || (navigator as Navigator & {standalone?:boolean}).standalone===true; }
export function iosDevice() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }
function supported() { return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
async function api(action:string,body:Record<string,unknown>={},token?:string) {
  if(!supabase) throw new Error('Phone reminders are not configured yet.');
  const response=await fetch(`${supabaseUrl}/functions/v1/push`,{method:'POST',headers:{'Content-Type':'application/json',apikey:supabasePublicKey,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error??'Phone reminders are unavailable.');
  return data;
}
function keyBytes(key:string) {
  const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function worker() {
  return await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Open the deployed MOODEE app, then try again.')),6000))]);
}
export function usePhoneNotifications(session:FocusSession|null) {
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [syncError,setSyncError]=useState('');
  const current=useRef(session);current.current=session;
  const device=useRef<Device|null>(loadValue<Device|null>('phoneDevice',null));
  const changing=useRef(false);
  const queue=useRef(Promise.resolve());
  const sync=useCallback(() => {
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      const d=device.current;
      if(!d || !supabase) return;
      const {data}=await supabase.auth.getSession();
      if(data.session?.user.id!==d.owner) return;
      d.version=Math.max(Date.now(),d.version+1);save('phoneDevice',d);
      try {
        await api('sync',{deviceId:d.id,version:d.version,jobs:pushSchedule(guestPlans.list(),current.current)},data.session.access_token);
        setSyncError('');
      } catch {
        setSyncError('Phone reminders could not sync. Reconnect before closing MOODEE; an earlier alert may still arrive.');
      }
    });
    return queue.current;
  },[]);
  const check=useCallback(async()=>{
    if(changing.current) return;
    if(!supported() || Notification.permission!=='granted' || !supabase || !device.current) {setEnabled(false);return;}
    const {data}=await supabase.auth.getSession();
    if(data.session?.user.id!==device.current.owner) {
      const previous=device.current;
      const registration=await navigator.serviceWorker.getRegistration();
      const subscription=await registration?.pushManager.getSubscription();
      if(!changing.current && device.current===previous) {
        await subscription?.unsubscribe();device.current=null;save('phoneDevice',null);setEnabled(false);
      }
      return;
    }
    const registration=await navigator.serviceWorker.getRegistration();
    const subscription=await registration?.pushManager.getSubscription();
    setEnabled(Boolean(subscription));
    if(subscription) await sync();
  },[sync]);
  useEffect(()=>{
    void check().catch(()=>{});
    const wake=()=>{if(document.visibilityState==='visible') void check().catch(()=>{});};
    const change=supabase?.auth.onAuthStateChange(()=>{window.setTimeout(()=>void check().catch(()=>{}),0);});
    window.addEventListener('online',wake);window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
    return()=>{change?.data.subscription.unsubscribe();window.removeEventListener('online',wake);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
  },[check]);
  useEffect(()=>{if(enabled) void sync();},[enabled,session?.deadline,session?.status,session?.stage,session?.subject,sync]);
  useEffect(()=>{
    const plans=()=>{if(enabled) void sync();};
    window.addEventListener('moodee:plans-changed',plans);window.addEventListener('storage',plans);
    return()=>{window.removeEventListener('moodee:plans-changed',plans);window.removeEventListener('storage',plans);};
  },[enabled,sync]);
  const enable=async()=>{
    if(busy) return;
    if(iosDevice() && !installedPwa()) {setMessage('On iPhone, tap Share → Add to Home Screen, open MOODEE from its icon, then enable reminders.');return;}
    if(!supported()) {setMessage('This browser does not support phone notifications. Try an installed app in Safari on iOS 16.4+ or Chrome on Android.');return;}
    if(Notification.permission==='denied') {setMessage('Notifications are blocked. Allow MOODEE in your browser or phone notification settings, then try again.');return;}
    changing.current=true;setBusy(true);setMessage('');
    try {
      // Ask inside the tap gesture, before any network or authentication awaits.
      const permission=await Notification.requestPermission();
      if(permission!=='granted') {setMessage('Notifications stayed off. You can enable them later.');return;}
      const status=await api('status');
      if(!status.configured) throw new Error('Phone reminders are not configured yet.');
      const identity=await tutorIdentity();
      const registration=await worker();
      let subscription=await registration.pushManager.getSubscription();
      if(subscription && device.current?.owner!==identity.user.id) {await subscription.unsubscribe();subscription=null;}
      subscription??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(status.publicKey)});
      const d=device.current?.owner===identity.user.id?device.current:{id:crypto.randomUUID(),owner:identity.user.id,version:0};
      await api('subscribe',{deviceId:d.id,subscription:subscription.toJSON()},identity.access_token);
      device.current=d;save('phoneDevice',d);setEnabled(true);
      await sync();setMessage('Phone reminders enabled on this device.');
    } catch(error) {setMessage(error instanceof Error?error.message:'Could not enable reminders. Please try again.');}
    finally {changing.current=false;setBusy(false);}
  };
  const disable=async()=>{
    changing.current=true;setBusy(true);setMessage('');
    try {
      const registration=await navigator.serviceWorker.getRegistration();
      const subscription=await registration?.pushManager.getSubscription();
      if(subscription && !await subscription.unsubscribe()) throw new Error('Could not turn reminders off. Try again.');
      const d=device.current;device.current=null;save('phoneDevice',null);setEnabled(false);setSyncError('');
      const {data}=await supabase!.auth.getSession();
      if(d && data.session?.user.id===d.owner) await api('unsubscribe',{deviceId:d.id},data.session.access_token);
      setMessage('Phone reminders are off on this device.');
    } catch(error) {setMessage(error instanceof Error?error.message:'Could not turn reminders off. Try again.');}
    finally {changing.current=false;setBusy(false);}
  };
  const test=async()=>{
    if(!enabled || busy) return;
    setBusy(true);
    try {
      const {data}=await supabase!.auth.getSession();
      await api('test',{deviceId:device.current!.id},data.session?.access_token);
      setMessage('Test queued. A notification should arrive shortly; check your phone’s notification settings if it does not.');
    } catch(error){setMessage(error instanceof Error?error.message:'Could not send the test.');}
    finally {setBusy(false);}
  };
  return {enabled,busy,message,syncError,enable,disable,test,sync};
}
