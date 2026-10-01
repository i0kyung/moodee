import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';
import { validateSubscription } from '../_shared/push-contract.ts';
import { dispatchPush } from '../_shared/push-dispatcher.ts';
interface Job {user_id:string;device_id:string;id:string;claim_id:string;subscription:unknown;attempts:number}
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const secret=Deno.env.get('PUSH_CRON_SECRET')??'';
Deno.serve(async req=>{
  if(req.method!=='POST' || !secret || req.headers.get('x-push-secret')!==secret) return new Response('Unauthorized',{status:401});
  try {
    const result=await dispatchPush<Job>({
      now:()=>Date.now(),
      claim:async()=>{
        const {data,error}=await admin.rpc('push_claim');
        if(error) throw new Error('Queue unavailable');
        return data??[];
      },
      latest:async j=>{
        const {data,error}=await admin.from('push_jobs').select('payload,expires_at').eq('user_id',j.user_id).eq('device_id',j.device_id).eq('id',j.id).eq('claim_id',j.claim_id).eq('status','sending').maybeSingle();
        if(error) throw new Error('Queue check failed');
        return data?{payload:data.payload,expiresAt:Date.parse(data.expires_at)}:null;
      },
      send:async(j,payload,expiresAt)=>{
        const details=webpush.generateRequestDetails(validateSubscription(j.subscription),JSON.stringify(payload),{
          TTL:Math.max(1,Math.min(3600,Math.ceil((expiresAt-Date.now())/1000))),urgency:'high',
          vapidDetails:{subject:Deno.env.get('VAPID_SUBJECT')??'https://i0kyung.github.io/moodee/',publicKey:Deno.env.get('VAPID_PUBLIC_KEY')!,privateKey:Deno.env.get('VAPID_PRIVATE_KEY')!},
        });
        const response=await fetch(details.endpoint,{method:details.method,headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(10000)});
        if(response.status===404 || response.status===410) {
          const {error}=await admin.from('push_devices').delete().eq('user_id',j.user_id).eq('device_id',j.device_id);
          if(error) throw new Error('Subscription cleanup failed');
          return;
        }
        if(!response.ok) throw new Error('Push provider unavailable');
      },
      finish:async(j,ok)=>{
        const changes=ok?{status:'sent',lease_until:null}:{status:j.attempts>=3?'sent':'pending',due_at:new Date(Date.now()+30000).toISOString(),lease_until:null};
        const {error}=await admin.from('push_jobs').update(changes).eq('user_id',j.user_id).eq('device_id',j.device_id).eq('id',j.id).eq('claim_id',j.claim_id);
        if(error) throw new Error('Acknowledgement failed');
      },
    });
    console.log(JSON.stringify({event:'push_dispatch',...result}));
    return Response.json(result);
  } catch {
    console.error('push_dispatch_failed');return new Response('Queue unavailable',{status:503});
  }
});
