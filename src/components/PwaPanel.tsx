import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { ScrollArea } from './ScrollArea';
import { installedPwa, iosDevice, type usePhoneNotifications } from '../lib/usePhoneNotifications';
import { applyUpdate, updateAvailable } from '../lib/pwa';
import styles from './PwaPanel.module.css';
interface InstallEvent extends Event { prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}> }
interface Props {open:boolean;onClose:()=>void;active:boolean;notifications:ReturnType<typeof usePhoneNotifications>}
export function PwaPanel({open,onClose,active,notifications:n}:Props) {
  const [prompt,setPrompt]=useState<InstallEvent|null>(null);
  const [installed,setInstalled]=useState(installedPwa);
  const [update,setUpdate]=useState(updateAvailable);
  useEffect(()=>{
    const install=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent);};
    const done=()=>{setInstalled(true);setPrompt(null);};
    const refreshed=()=>setUpdate(true);
    window.addEventListener('beforeinstallprompt',install);window.addEventListener('appinstalled',done);window.addEventListener('moodee:pwa-update',refreshed);
    return()=>{window.removeEventListener('beforeinstallprompt',install);window.removeEventListener('appinstalled',done);window.removeEventListener('moodee:pwa-update',refreshed);};
  },[]);
  return <Sheet open={open} onClose={onClose} title="Take MOODEE with you" subtitle="A little space on your home screen." action={<button className={styles.close} onClick={onClose} aria-label="Close app settings">×</button>}>
    <ScrollArea className={styles.scroll}><div className={styles.content}>
      <section className={styles.card}><span className={styles.eyebrow}>YOUR COZY APP</span><h3>{installed?'MOODEE is installed':'Add to your home screen'}</h3>
        <p>{installed?'Open MOODEE from its icon whenever you need a little focus.':iosDevice()?'In Safari, tap Share → Add to Home Screen → Add. Then open MOODEE from its new icon.':'Install MOODEE for an app window of its own. You can also use your browser’s Install app or Add to Home Screen menu.'}</p>
        {!installed && prompt && <button className="pill pill-primary" onClick={async()=>{await prompt.prompt();await prompt.userChoice;setPrompt(null);}}>Install MOODEE</button>}
      </section>
      <section className={styles.card}><span className={styles.eyebrow}>A GENTLE NUDGE</span><h3>Phone reminders {n.enabled?'· On':'· Off'}</h3>
        <p>Get local study reminders, a focus-finished alert, and a reminder to return after a Pomodoro break—even when MOODEE is closed.</p>
        <p className={styles.small}>Enabling reminders sends your local plan titles and timer deadlines to MOODEE’s server for delivery. Google plans use Google Calendar’s own reminders. No Google login is needed.</p>
        <button className="pill pill-primary" disabled={n.busy} onClick={()=>void(n.enabled?n.disable():n.enable())}>{n.busy?'One moment…':n.enabled?'Turn off on this device':'Enable phone reminders'}</button>
        {n.enabled && <div className={styles.actions}><button onClick={()=>void n.test()} disabled={n.busy}>Send test</button><button onClick={()=>void n.sync()} disabled={n.busy}>Sync reminders</button></div>}
        {(n.message||n.syncError) && <p role="status" className={styles.message}>{n.syncError||n.message}</p>}
        <p className={styles.small}>Allow notifications on this device. iPhone needs iOS 16.4+ and installation to Home Screen. Delivery can be delayed by connection, battery saving, or Focus settings.</p>
      </section>
      {update && <section className={styles.card}><h3>A fresh MOODEE is ready</h3><p>{active?'Finish your session to update. Your timer keeps its place.':'Update when you’re ready.'}</p><button className="pill pill-soft" disabled={active} onClick={()=>void applyUpdate()}>Update app</button></section>}
      <p className={styles.small}>Visited rooms can reopen offline. Tutor, Google Calendar, and scheduling phone reminders need an internet connection.</p>
    </div></ScrollArea>
  </Sheet>;
}
