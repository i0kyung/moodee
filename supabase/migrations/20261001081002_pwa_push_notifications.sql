-- Browser subscriptions and reminder payloads are private to the verified Edge Function.
create table public.push_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  subscription jsonb not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(user_id,device_id)
);
create table public.push_jobs (
  user_id uuid not null,
  device_id uuid not null,
  id text not null,
  due_at timestamptz not null,
  expires_at timestamptz not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent')),
  attempts integer not null default 0,
  lease_until timestamptz,
  claim_id uuid,
  primary key(user_id,device_id,id),
  foreign key(user_id,device_id) references public.push_devices on delete cascade
);
create index push_jobs_due on public.push_jobs(due_at) where status <> 'sent';
alter table public.push_devices enable row level security;
alter table public.push_jobs enable row level security;
revoke all on public.push_devices, public.push_jobs from anon, authenticated;
grant all on public.push_devices, public.push_jobs to service_role;

-- One account/device lock serializes subscriptions and whole-schedule replacements.
create function public.push_subscribe(p_uid uuid,p_device uuid,p_subscription jsonb)
returns void language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,0));
  if (select count(*) from public.push_devices where user_id=p_uid) >= 5
     and not exists(select 1 from public.push_devices where user_id=p_uid and device_id=p_device)
  then raise exception 'Device limit'; end if;
  insert into public.push_devices(user_id,device_id,subscription) values(p_uid,p_device,p_subscription)
  on conflict(user_id,device_id) do update set subscription=excluded.subscription,updated_at=now();
end $$;
create function public.push_replace(p_uid uuid,p_device uuid,p_version bigint,p_jobs jsonb)
returns boolean language plpgsql set search_path='' as $$
declare v_old bigint;
begin
  select version into v_old from public.push_devices where user_id=p_uid and device_id=p_device for update;
  if not found then raise exception 'Device not subscribed'; end if;
  if p_version <= v_old then return false; end if;
  if jsonb_typeof(p_jobs)<>'array' or jsonb_array_length(p_jobs)>100 then raise exception 'Job limit'; end if;
  delete from public.push_jobs where user_id=p_uid and device_id=p_device and status<>'sent'
    and id not in(select j->>'id' from jsonb_array_elements(p_jobs) j) and id not like 'test:%';
  insert into public.push_jobs(user_id,device_id,id,due_at,expires_at,payload)
    select p_uid,p_device,j->>'id',(j->>'dueAt')::timestamptz,(j->>'expiresAt')::timestamptz,
      jsonb_build_object('id',j->>'id','title',j->>'title','body',j->>'body','destination',j->>'destination')
    from jsonb_array_elements(p_jobs) j
  on conflict(user_id,device_id,id) do update set payload=excluded.payload,due_at=excluded.due_at,expires_at=excluded.expires_at;
  update public.push_devices set version=p_version,updated_at=now() where user_id=p_uid and device_id=p_device;
  return true;
end $$;
create function public.push_test(p_uid uuid,p_device uuid)
returns void language sql set search_path='' as $$
  insert into public.push_jobs(user_id,device_id,id,due_at,expires_at,payload)
  values(p_uid,p_device,'test:'||floor(extract(epoch from now())/60)::text,now(),now()+interval '2 minutes',
    '{"id":"moodee-test","title":"Hello from MOODEE","body":"Your phone reminders are ready. A little space for your plans.","destination":"calendar"}'::jsonb)
  on conflict do nothing;
$$;
create function public.push_claim()
returns table(user_id uuid,device_id uuid,id text,payload jsonb,subscription jsonb,claim_id uuid,expires_at timestamptz,attempts integer)
language sql set search_path='' as $$
  with ready as (
    select j.user_id,j.device_id,j.id from public.push_jobs j
    where j.due_at<=now() and j.expires_at>now() and j.attempts<3
      and (j.status='pending' or (j.status='sending' and j.lease_until<now()))
    order by j.due_at limit 40 for update skip locked
  ), claimed as (
    update public.push_jobs j set status='sending',lease_until=now()+interval '60 seconds',claim_id=gen_random_uuid(),attempts=j.attempts+1
    from ready r where (j.user_id,j.device_id,j.id)=(r.user_id,r.device_id,r.id)
    returning j.*
  )
  select c.user_id,c.device_id,c.id,c.payload,d.subscription,c.claim_id,c.expires_at,c.attempts
  from claimed c join public.push_devices d using(user_id,device_id);
$$;
revoke all on function public.push_subscribe(uuid,uuid,jsonb), public.push_replace(uuid,uuid,bigint,jsonb), public.push_test(uuid,uuid), public.push_claim() from public,anon,authenticated;
grant execute on function public.push_subscribe(uuid,uuid,jsonb), public.push_replace(uuid,uuid,bigint,jsonb), public.push_test(uuid,uuid), public.push_claim() to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Store moodee_push_url and moodee_push_cron_secret in Vault during setup.
create function public.dispatch_moodee_push() returns void language plpgsql set search_path='' as $$
declare v_url text; v_secret text;
begin
  if not exists(select 1 from public.push_jobs where due_at<=now() and expires_at>now() and attempts<3 and (status='pending' or(status='sending' and lease_until<now()))) then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name='moodee_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='moodee_push_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url:=v_url||'/functions/v1/push-dispatch',headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',v_secret),body:='{}'::jsonb,timeout_milliseconds:=20000);
end $$;
revoke all on function public.dispatch_moodee_push() from public,anon,authenticated;
select cron.schedule('moodee-phone-reminders','15 seconds','select public.dispatch_moodee_push()');
select cron.schedule('moodee-push-cleanup','17 19 * * *',$$
  delete from public.push_jobs where expires_at<now()-interval '7 days';
  delete from public.push_devices where updated_at<now()-interval '367 days';
$$);
