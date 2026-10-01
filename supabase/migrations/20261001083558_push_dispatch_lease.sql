-- Claim one concurrent delivery batch at a time. A lease covers only its own requests,
-- not up to eight subsequent batches that have not started sending yet.
create or replace function public.push_claim()
returns table(user_id uuid,device_id uuid,id text,payload jsonb,subscription jsonb,claim_id uuid,expires_at timestamptz,attempts integer)
language sql set search_path='' as $$
  with ready as (
    select j.user_id,j.device_id,j.id from public.push_jobs j
    where j.due_at<=now() and j.expires_at>now() and j.attempts<3
      and (j.status='pending' or (j.status='sending' and j.lease_until<now()))
    order by j.due_at limit 5 for update skip locked
  ), claimed as (
    update public.push_jobs j set status='sending',lease_until=now()+interval '60 seconds',claim_id=gen_random_uuid(),attempts=j.attempts+1
    from ready r where (j.user_id,j.device_id,j.id)=(r.user_id,r.device_id,r.id)
    returning j.*
  )
  select c.user_id,c.device_id,c.id,c.payload,d.subscription,c.claim_id,c.expires_at,c.attempts
  from claimed c join public.push_devices d using(user_id,device_id);
$$;
