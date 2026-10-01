import { expect, it } from 'vitest';
import { validateSubscription, validateJobs } from './push-contract';
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys:{ p256dh: 'B'+'a'.repeat(86), auth:'b'.repeat(22) } };
it('accepts browser push providers but rejects arbitrary URLs, credentials, and redirects', () => {
  expect(validateSubscription(subscription).endpoint).toBe(subscription.endpoint);
  for (const endpoint of ['http://fcm.googleapis.com/test','https://127.0.0.1/test','https://fcm.googleapis.com.evil.test/test','https://user:pass@fcm.googleapis.com/test','https://evil.test/push']) {
    expect(() => validateSubscription({...subscription,endpoint})).toThrow();
  }
  expect(() => validateSubscription({...subscription,keys:{p256dh:'bad',auth:'bad'}})).toThrow();
});
it('bounds jobs and destinations; rejects past or oversized reminder payloads', () => {
  const now=1000, job={id:'plan:abc',kind:'plan',dueAt:new Date(2000).toISOString(),expiresAt:new Date(60000).toISOString(),title:'MOODEE',body:'Time to study',destination:'calendar'};
  expect(validateJobs([job],now)).toHaveLength(1);
  for(const change of [{destination:'https://evil.test'}, {dueAt:new Date(-20000).toISOString()}, {body:'a'.repeat(241)}, {kind:'anything'}, {expiresAt:new Date(1000).toISOString()}]) expect(()=>validateJobs([{...job,...change}],now)).toThrow();
  expect(()=>validateJobs(Array(101).fill(job),now)).toThrow();
  expect(()=>validateJobs([job,job],now)).toThrow();
});
