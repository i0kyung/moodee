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
  return <div className={styles.layer} style={{pointerEvents:open?'auto':'none'}}><Sheet open={open} onClose={onClose} title="Take MOODEE with you" action={<button className={styles.close} onClick={onClose} aria-label="Close app settings">×</button>}>
    <ScrollArea className={styles.scroll}><div className={styles.content}>
      <section className={styles.card}><h3>{installed?'MOODEE is installed':'Add to your home screen'}</h3>
        <p>{installed?'Open MOODEE from your home screen.':iosDevice()?'Safari → Share → Add to Home Screen → Add. Then open the new icon.':'Use your browser’s Install app or Add to Home Screen menu.'}</p>
        {!installed && prompt && <button className="pill pill-primary" onClick={async()=>{await prompt.prompt();await prompt.userChoice;setPrompt(null);}}>Install MOODEE</button>}
      </section>
      <section className={styles.card}><h3>Phone reminders {n.enabled?'· On':'· Off'}</h3>
        <p>Study reminders and focus / break alerts, even when MOODEE is closed.</p>
        <p className={styles.small}>Enabling alerts sends plan titles and timer deadlines to MOODEE’s server. Google plans use Google Calendar reminders.</p>
        <button className="pill pill-primary" disabled={n.busy} onClick={()=>void(n.enabled?n.disable():n.enable())}>{n.busy?'One moment…':n.enabled?'Turn off':'Enable reminders'}</button>
        {n.enabled && <div className={styles.actions}><button onClick={()=>void n.test()} disabled={n.busy}>Send test</button><button onClick={()=>void n.sync()} disabled={n.busy}>Sync reminders</button></div>}
        {(n.message||n.syncError) && <p role="status" className={styles.message}>{n.syncError||n.message}</p>}
        <p className={styles.small}>{iosDevice()?'Requires iOS 16.4+ and Home Screen installation. ':''}Allow notifications when asked. Connection, battery saving, or Focus settings may delay alerts.</p>
      </section>
      {update && <section className={styles.card}><h3>Update available</h3>{active && <p>Finish your session to update.</p>}<button className="pill pill-soft" disabled={active} onClick={()=>void applyUpdate()}>Update app</button></section>}
      <p className={styles.small}>Tutor, Google Calendar, and reminder scheduling need internet.</p>
    </div></ScrollArea>
  </Sheet></div>;
}
