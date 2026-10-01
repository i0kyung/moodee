export interface Subscription { endpoint: string; keys: { p256dh: string; auth: string } }
export interface NotificationJob {
  id: string; kind: 'plan'|'focus'|'break'; dueAt: string; expiresAt: string;
  title: string; body: string; destination: 'calendar'|'classroom';
}
export function validateSubscription(value: unknown): Subscription {
  const s = value as Subscription;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 2048) throw new Error('Invalid subscription.');
  const u = new URL(s.endpoint);
  const allowed = ['fcm.googleapis.com','updates.push.services.mozilla.com','updates-autopush.stage.mozaws.net','web.push.apple.com'];
  const windows = /^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash || (!allowed.includes(u.hostname) && !windows)) throw new Error('Unsupported push service.');
  if (!s.keys || !/^[A-Za-z0-9_-]{87}=?$/.test(s.keys.p256dh) || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys.auth)) throw new Error('Invalid subscription keys.');
  return {endpoint:u.href,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}};
}
export function validateJobs(value: unknown, now = Date.now()): NotificationJob[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Too many reminders.');
  const ids = new Set<string>();
  return value.map((j: NotificationJob) => {
    if (!j || typeof j.id !== 'string' || !/^[a-zA-Z0-9:_-]{1,140}$/.test(j.id) || ids.has(j.id) || !['plan','focus','break'].includes(j.kind) || !['calendar','classroom'].includes(j.destination)) throw new Error('Invalid reminder.');
    ids.add(j.id);
    if (typeof j.title !== 'string' || j.title.length > 100 || !j.title.trim() || typeof j.body !== 'string' || j.body.length > 240) throw new Error('Invalid notification text.');
    const due = Date.parse(j.dueAt), expiry = Date.parse(j.expiresAt);
    if (!Number.isFinite(due) || !Number.isFinite(expiry) || due < now - 10000 || due > now + 366*86400000 || expiry <= due || expiry > due + 7200000) throw new Error('Invalid reminder time.');
    return { id:j.id,kind:j.kind,dueAt:new Date(due).toISOString(),expiresAt:new Date(expiry).toISOString(),title:j.title.trim(),body:j.body,destination:j.destination };
  });
}
