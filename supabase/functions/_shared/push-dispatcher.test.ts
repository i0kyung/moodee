import { expect, it, vi } from 'vitest';
import { dispatchPush } from './push-dispatcher';
it('rechecks a claimed job and skips a cancelled row before delivering',async()=>{
  const send=vi.fn(),finish=vi.fn();let claimed=false;
  const result=await dispatchPush({claim:async()=>claimed?[]:(claimed=true,[{id:'cancelled'}]),latest:async()=>null,send,finish,now:()=>1000});
  expect(send).not.toHaveBeenCalled();expect(finish).not.toHaveBeenCalled();expect(result).toEqual({sent:0,failed:0});
});
it('finishes a delivery batch before claiming the next and treats expiry as cancelled',async()=>{
  const order:string[]=[];let batch=0;
  const result=await dispatchPush({
    claim:async()=>{order.push('claim');return batch++<2?[{id:String(batch)}]:[];},
    latest:async j=>({payload:{id:j.id},expiresAt: j.id==='2'?500:10000}),
    send:async()=>{order.push('send');},finish:async(_j,ok)=>{order.push(ok?'sent':'retry');},now:()=>1000,
  });
  expect(order).toEqual(['claim','send','sent','claim','claim']);expect(result).toEqual({sent:1,failed:0});
});
it('marks a failed request for bounded retry without crashing the rest of the batch',async()=>{
  let batch=0;const finish=vi.fn();
  const result=await dispatchPush({claim:async()=>batch++===0?[{id:'one'}]:[],latest:async()=>({payload:{},expiresAt:10000}),send:async()=>{throw new Error('offline');},finish,now:()=>1000});
  expect(finish).toHaveBeenCalledWith({id:'one'},false);expect(result).toEqual({sent:0,failed:1});
});
