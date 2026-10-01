import { expect, it } from 'vitest';
import { pushHandler } from './push-handler';
const origin = 'https://i0kyung.github.io';
const request = (body: unknown, token='valid') => new Request('https://example.test/push', {method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
it('verifies identity on every write and never accepts a caller supplied owner', async () => {
  const calls: string[] = [];
  const handler = pushHandler({publicKey:'public',origins:[origin],user:async t=>t==='valid'?'verified-user':null,perform:async(uid)=>{calls.push(uid);return {enabled:true};}});
  expect((await handler(request({action:'sync',userId:'victim',deviceId:crypto.randomUUID(),version:1,jobs:[]}))).status).toBe(200);
  expect(calls).toEqual(['verified-user']);
  expect((await handler(request({action:'unsubscribe',deviceId:crypto.randomUUID()},'invalid'))).status).toBe(401);
  const status = await handler(request({action:'status'},''));
  expect(await status.json()).toEqual({configured:true,publicKey:'public'});
});
it('rejects unknown actions, invalid bodies, oversized input and other origins', async () => {
  let writes=0;
  const handler=pushHandler({publicKey:'public',origins:[origin],user:async()=> 'user',perform:async()=>{writes++;return {};}});
  expect((await handler(request({action:'dispatch'}))).status).toBe(400);
  expect((await handler(request({action:'sync',deviceId:'bad',jobs:[]}))).status).toBe(400);
  expect((await handler(new Request('https://test/push',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}))).status).toBe(403);
  expect(writes).toBe(0);
});
