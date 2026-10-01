import { validateJobs, validateSubscription } from './push-contract.ts';
interface Dependencies {
  publicKey: string; origins: string[]; user: (token: string) => Promise<string|null>;
  perform: (uid: string, action: string, body: Record<string,unknown>) => Promise<unknown>;
}
export function pushHandler(d: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const origin=req.headers.get('origin')??'';
    const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
    const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if (!d.origins.includes(origin)) return reply({error:'Origin not allowed.'},403);
    if (req.method==='OPTIONS') return new Response(null,{status:204,headers});
    if (req.method!=='POST') return reply({error:'Use POST.'},405);
    try {
      const text=await req.text();
      if(text.length>70000) return reply({error:'Request too large.'},413);
      const body=JSON.parse(text);
      if(!body || typeof body!=='object' || Array.isArray(body)) return reply({error:'Invalid request.'},400);
      if(body.action==='status') return reply({configured:Boolean(d.publicKey),publicKey:d.publicKey});
      if(!d.publicKey) return reply({error:'Phone notifications are not configured yet.'},503);
      if(!['subscribe','sync','unsubscribe','test'].includes(body.action)) return reply({error:'Unknown action.'},400);
      const uid=await d.user((req.headers.get('authorization')??'').replace(/^Bearer /i,''));
      if(!uid) return reply({error:'Guest access could not start. Please try again.'},401);
      if(typeof body.deviceId!=='string' || !/^[0-9a-f-]{36}$/i.test(body.deviceId)) return reply({error:'Invalid device.'},400);
      if(body.action==='subscribe') body.subscription=validateSubscription(body.subscription);
      if(body.action==='sync') {
        if(!Number.isSafeInteger(body.version) || body.version<0) return reply({error:'Invalid revision.'},400);
        body.jobs=validateJobs(body.jobs);
      }
      return reply(await d.perform(uid,body.action,body));
    } catch (error) {
      if(error instanceof SyntaxError || error instanceof TypeError || (error instanceof Error && /Invalid |Unsupported |Too many /.test(error.message))) return reply({error:'Invalid notification request.'},400);
      // No endpoint, keys, title or tokens in logs or errors.
      console.error('push_request_failed');
      return reply({error:'Could not save notifications. Check your connection and try again.'},503);
    }
  };
}
