do $$
declare
  a uuid := '00000000-0000-4000-8000-000000000001';
  b uuid := '00000000-0000-4000-8000-000000000002';
  result jsonb;
  token uuid;
  payload jsonb := '{"version":1,"model":"test-fixture","kcal":610,"protein":22,"carbs":90,"fat":16,"fibre":10,"assumptions":["Test fixture only"]}';
  period date := date_trunc('month', timezone('UTC', now()))::date;
  amount numeric;
begin
  result := public.claim_nutrition_request(a, repeat('1',32), repeat('a',64), 'test-v1', false, 0.01);
  if result->>'state' <> 'disabled' then raise exception 'model disabled gate failed'; end if;
  result := public.claim_nutrition_request(a, repeat('1',32), repeat('a',64), 'test-v1', true, 0.01);
  if result->>'state' <> 'budget_exceeded' then raise exception 'zero budget must block'; end if;
  update public.nutrition_budgets set limit_usd = 0.03 where nutrition_budgets.month = period;
  result := public.claim_nutrition_request(a, repeat('1',32), repeat('a',64), 'test-v1', true, 0.01);
  if result->>'state' <> 'claimed' then raise exception 'initial claim failed'; end if;
  token := (result->>'leaseToken')::uuid;
  result := public.claim_nutrition_request(b, repeat('2',32), repeat('a',64), 'test-v1', true, 0.01);
  if result->>'state' <> 'pending' then raise exception 'shared single-flight failed'; end if;
  select reserved_usd into amount from public.nutrition_budgets where nutrition_budgets.month = period;
  if amount <> 0.01 then raise exception 'pending duplicate consumed budget'; end if;
  if public.finish_nutrition_request(repeat('a',64), gen_random_uuid(), payload) then raise exception 'wrong lease completed cache'; end if;
  begin
    perform public.finish_nutrition_request(repeat('a',64), token, '{"version":1,"model":"bad","kcal":-1,"protein":0,"carbs":0,"fat":0,"fibre":0,"assumptions":[]}');
    raise exception 'invalid nutrition accepted';
  exception when invalid_parameter_value then null;
  end;
  if not public.finish_nutrition_request(repeat('a',64), token, payload) then raise exception 'valid completion failed'; end if;
  result := public.claim_nutrition_request(b, repeat('2',32), repeat('a',64), 'test-v1', false, 0.01);
  if result->>'state' <> 'ready' or result->'estimate' <> payload then raise exception 'ready result unavailable to coalesced request'; end if;
  result := public.claim_nutrition_request(a, repeat('3',32), repeat('a',64), 'test-v1', false, 0.01);
  if result->>'state' <> 'ready' then raise exception 'cache miss when model disabled'; end if;
  result := public.claim_nutrition_request(a, repeat('1',32), repeat('b',64), 'test-v1', true, 0.01);
  if result->>'state' <> 'conflict' then raise exception 'idempotency conflict accepted'; end if;
  result := public.claim_nutrition_request(a, repeat('4',32), repeat('b',64), 'test-v1', true, 0.01);
  if result->>'state' <> 'claimed' then raise exception 'second claim failed'; end if;
  token := (result->>'leaseToken')::uuid;
  if not public.fail_nutrition_request(repeat('b',64), token) then raise exception 'failure transition failed'; end if;
  result := public.claim_nutrition_request(a, repeat('4',32), repeat('b',64), 'test-v1', true, 0.01);
  if result->>'state' <> 'claimed' then raise exception 'retry claim failed'; end if;
  if public.finish_nutrition_request(repeat('b',64), token, payload) then raise exception 'stale worker overwrote retry'; end if;
  result := public.claim_nutrition_request(a, repeat('5',32), repeat('c',64), 'test-v1', true, 0.01);
  if result->>'state' <> 'budget_exceeded' then raise exception 'budget overrun accepted'; end if;
  select reserved_usd into amount from public.nutrition_budgets where nutrition_budgets.month = period;
  if amount <> 0.03 then raise exception 'conservative reservation ledger wrong'; end if;
  update public.nutrition_daily_usage set requests = 100 where owner_id = b;
  result := public.claim_nutrition_request(b, repeat('6',32), repeat('a',64), 'test-v1', false, 0.01);
  if result->>'state' <> 'rate_limited' then raise exception 'per-owner request cap failed'; end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
do $$
begin
  if exists(select 1 from public.nutrition_requests where owner_id <> auth.uid()) then raise exception 'cross-owner requests leaked'; end if;
  begin
    insert into public.nutrition_cache(cache_key, estimator_version, state) values(repeat('d',64), 'injected', 'ready');
    raise exception 'authenticated caller wrote shared cache';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_nutrition_request(auth.uid(), repeat('7',32), repeat('d',64), 'test-v1', true, 0.01);
    raise exception 'client called privileged claim RPC';
  exception when insufficient_privilege then null;
  end;
  insert into storage.objects(bucket_id, name) values('meal-photos', auth.uid()::text || '/fixture.jpg');
  begin
    insert into storage.objects(bucket_id, name) values('meal-photos', '00000000-0000-4000-8000-000000000001/other.jpg');
    raise exception 'cross-owner photo upload allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
insert into storage.objects(bucket_id, name) values('meal-photos', '00000000-0000-4000-8000-000000000001/private.jpg');
set role authenticated;
do $$ begin
  if (select count(*) from storage.objects) <> 1 then raise exception 'cross-owner photo read allowed'; end if;
end; $$;
reset role;
