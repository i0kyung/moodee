export interface DispatchDependencies<Job> {
  claim:()=>Promise<Job[]>;
  latest:(job:Job)=>Promise<{payload:unknown;expiresAt:number}|null>;
  send:(job:Job,payload:unknown,expiresAt:number)=>Promise<void>;
  finish:(job:Job,ok:boolean)=>Promise<void>;
  now:()=>number;
}
export async function dispatchPush<Job>(d:DispatchDependencies<Job>) {
  let sent=0,failed=0;
  for(let batch=0;batch<8;batch++) {
    const jobs=await d.claim();
    if(!jobs.length) break;
    await Promise.all(jobs.map(async job=>{
      try {
        const current=await d.latest(job);
        if(!current || current.expiresAt<=d.now()) return;
        await d.send(job,current.payload,current.expiresAt);
        await d.finish(job,true);sent++;
      } catch {
        failed++;
        await d.finish(job,false);
      }
    }));
  }
  return {sent,failed};
}
