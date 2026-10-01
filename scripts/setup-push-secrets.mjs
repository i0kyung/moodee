// Generate once per project. Files live in .git and never enter a frontend build.
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import webpush from 'web-push';
const directory = '.git/moodee-push-setup';
await mkdir(directory, {recursive:true});
try { await access(`${directory}/secrets.env`); console.log('Existing setup retained; keys were not rotated.'); process.exit(0); } catch { /* First setup. */ }
const keys=webpush.generateVAPIDKeys();
const secret=randomBytes(32).toString('base64url');
const project=process.argv[2];
if(!project || !/^[a-z]{20}$/.test(project)) throw new Error('Usage: node scripts/setup-push-secrets.mjs YOUR_PROJECT_REF');
await writeFile(`${directory}/secrets.env`,`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=https://i0kyung.github.io/moodee/\nPUSH_CRON_SECRET=${secret}\n`,{mode:0o600});
await writeFile(`${directory}/vault.sql`,`do $$\nbegin\nif not exists(select 1 from vault.secrets where name='moodee_push_cron_secret') then\nperform vault.create_secret('${secret}','moodee_push_cron_secret');\nelse\nperform vault.update_secret((select id from vault.secrets where name='moodee_push_cron_secret'),'${secret}');\nend if;\nif not exists(select 1 from vault.secrets where name='moodee_push_url') then\nperform vault.create_secret('https://${project}.supabase.co','moodee_push_url');\nelse\nperform vault.update_secret((select id from vault.secrets where name='moodee_push_url'),'https://${project}.supabase.co');\nend if;\nend $$;\n`,{mode:0o600});
console.log('Push secrets generated privately in .git/moodee-push-setup. No values printed.');
