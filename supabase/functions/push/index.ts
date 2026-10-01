import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { pushHandler } from '../_shared/push-handler.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(pushHandler({
  publicKey:Deno.env.get('VAPID_PUBLIC_KEY')??'',
  origins:[Deno.env.get('APP_ORIGINS')??'',Deno.env.get('PWA_PREVIEW_ORIGIN')??''].join(',').split(',').map(s=>s.trim()).filter(Boolean),
  user:async token=>{const {data,error}=await admin.auth.getUser(token);return error?null:data.user?.id??null;},
  perform:async (uid,action,b)=>{
    let result;
    if(action==='subscribe') result=await admin.rpc('push_subscribe',{p_uid:uid,p_device:b.deviceId,p_subscription:b.subscription});
    else if(action==='sync') result=await admin.rpc('push_replace',{p_uid:uid,p_device:b.deviceId,p_version:b.version,p_jobs:b.jobs});
    else if(action==='test') result=await admin.rpc('push_test',{p_uid:uid,p_device:b.deviceId});
    else result=await admin.from('push_devices').delete().eq('user_id',uid).eq('device_id',b.deviceId);
    if(result.error) throw new Error('Notification storage failed');
    return {ok:true};
  },
}));
