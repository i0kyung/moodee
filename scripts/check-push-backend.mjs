import { readFile } from 'node:fs/promises';
const env=Object.fromEntries((await readFile('.env','utf8')).split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{
  const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];
}));
const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY;
const settings=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}});
const auth=await settings.json();
console.log(JSON.stringify({settingsStatus:settings.status,anonymous:auth.external?.anonymous_users,google:auth.external?.google}));
const response=await fetch(url+'/functions/v1/push',{method:'POST',headers:{apikey:key,Origin:process.argv[2]||'https://i0kyung.github.io','Content-Type':'application/json'},body:JSON.stringify({action:'status'})});
const data=await response.json();
console.log(JSON.stringify({pushStatus:response.status,configured:data.configured,hasPublicKey:Boolean(data.publicKey)}));
if(response.status!==200 || !data.configured) process.exitCode=1;
if(process.argv.includes('--dispatcher')) {
  // Only run against an empty queue; this is a scheduler smoke test, not a mass send.
  const secrets=Object.fromEntries((await readFile('.git/moodee-push-setup/secrets.env','utf8')).split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
  const dispatch=await fetch(url+'/functions/v1/push-dispatch',{method:'POST',headers:{'Content-Type':'application/json','x-push-secret':secrets.PUSH_CRON_SECRET},body:'{}'});
  const result=await dispatch.json();
  console.log(JSON.stringify({dispatchStatus:dispatch.status,sent:result.sent,failed:result.failed}));
  if(dispatch.status!==200) process.exitCode=1;
}
