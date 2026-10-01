-- Rolled back: never schedules a real notification or leaves an auth account behind.
begin;
do $$
declare u uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); claims integer; n integer;
begin
  insert into auth.users(id) values(u);
  perform public.push_subscribe(u,d,'{"endpoint":"https://fcm.googleapis.com/fcm/send/test-only","keys":{}}'::jsonb);
  if not public.push_replace(u,d,10,'[{"id":"one","dueAt":"2099-01-01T00:00:00Z","expiresAt":"2099-01-01T00:05:00Z","title":"Test","body":"Test","destination":"calendar"}]'::jsonb) then raise exception 'Replacement failed'; end if;
  if public.push_replace(u,d,9,'[]'::jsonb) then raise exception 'Stale write accepted'; end if;
  select count(*) into n from public.push_jobs where user_id=u;
  if n<>1 then raise exception 'Stale write deleted newer schedule'; end if;
  perform public.push_test(u,d); perform public.push_test(u,d);
  select count(*) into n from public.push_jobs where user_id=u and id like 'test:%';
  if n<>1 then raise exception 'Test rate limit failed'; end if;
  select count(*) into claims from public.push_claim() where user_id=u;
  if claims<>1 then raise exception 'Due claim failed'; end if;
  select count(*) into claims from public.push_claim() where user_id=u;
  if claims<>0 then raise exception 'Active lease was claimed twice'; end if;
  for n in 1..6 loop
    insert into public.push_jobs(user_id,device_id,id,due_at,expires_at,payload) values(u,d,'batch:'||n,now(),now()+interval '2 minutes','{}'::jsonb);
  end loop;
  select count(*) into claims from public.push_claim() where user_id=u;
  if claims<>5 then raise exception 'Delivery batch exceeded concurrency limit'; end if;
  select count(*) into claims from public.push_claim() where user_id=u;
  if claims<>1 then raise exception 'Remaining delivery batch was lost'; end if;
  perform public.push_replace(u,d,11,'[]'::jsonb);
  if exists(select 1 from public.push_jobs where user_id=u and id='one') then raise exception 'Cancellation failed'; end if;
  if has_table_privilege('authenticated','public.push_devices','SELECT') or has_table_privilege('anon','public.push_jobs','SELECT') or has_function_privilege('authenticated','public.push_claim()','EXECUTE') then raise exception 'Private data accessible'; end if;
  delete from public.push_devices where user_id=u and device_id=d;
  if exists(select 1 from public.push_jobs where user_id=u) then raise exception 'Unsubscribe did not remove jobs'; end if;
end $$;
rollback;
select 'push queue isolation, stale writes, cancellation, deduplication and leases passed' as verification;
