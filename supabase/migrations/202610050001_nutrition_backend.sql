create table public.nutrition_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  estimator_version text not null,
  state text not null check (state in ('pending', 'ready', 'failed')),
  result jsonb,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.nutrition_requests (
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (client_id ~ '^[a-f0-9]{32}$'),
  cache_key text not null references public.nutrition_cache(cache_key),
  state text not null check (state in ('pending', 'completed', 'failed')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, client_id)
);
create index nutrition_requests_by_cache on public.nutrition_requests(cache_key, state);

create table public.nutrition_daily_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  requests integer not null default 0 check (requests >= 0),
  primary key (owner_id, day)
);

create table public.nutrition_budgets (
  month date primary key,
  limit_usd numeric(12,6) not null default 0 check (limit_usd >= 0),
  reserved_usd numeric(12,6) not null default 0 check (reserved_usd >= 0)
);

alter table public.nutrition_cache enable row level security;
alter table public.nutrition_requests enable row level security;
alter table public.nutrition_daily_usage enable row level security;
alter table public.nutrition_budgets enable row level security;
revoke all on public.nutrition_cache, public.nutrition_requests, public.nutrition_daily_usage, public.nutrition_budgets from anon, authenticated;
grant select on public.nutrition_requests to authenticated;
grant all on public.nutrition_cache, public.nutrition_requests, public.nutrition_daily_usage, public.nutrition_budgets to service_role;
create policy nutrition_requests_owner_read on public.nutrition_requests for select to authenticated using (owner_id = (select auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp']);
create policy meal_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy meal_photos_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy meal_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.claim_nutrition_request(
  p_owner uuid, p_client_id text, p_cache_key text, p_estimator_version text,
  p_allow_model boolean, p_max_cost numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing public.nutrition_requests%rowtype;
  cached public.nutrition_cache%rowtype;
  quota integer;
  budget public.nutrition_budgets%rowtype;
  period date := date_trunc('month', timezone('UTC', now()))::date;
  today date := timezone('UTC', now())::date;
  token uuid := gen_random_uuid();
begin
  if p_owner is null or p_client_id is null or p_client_id !~ '^[a-f0-9]{32}$'
    or p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_allow_model is null
    or p_estimator_version is null or length(p_estimator_version) not between 1 and 100 then
    raise exception 'invalid request identifiers' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_cache_key, 0));
  select * into existing from public.nutrition_requests where owner_id = p_owner and client_id = p_client_id;
  if found and existing.cache_key <> p_cache_key then
    return jsonb_build_object('state', 'conflict');
  end if;
  if existing.state = 'completed' then
    return jsonb_build_object('state', 'ready', 'estimate', existing.result);
  end if;
  select * into cached from public.nutrition_cache where cache_key = p_cache_key;
  if cached.cache_key is not null and cached.estimator_version <> p_estimator_version then
    return jsonb_build_object('state', 'conflict');
  end if;
  if cached.state = 'ready' then
    if existing.client_id is null then
      insert into public.nutrition_daily_usage(owner_id, day) values (p_owner, today) on conflict do nothing;
      update public.nutrition_daily_usage set requests = requests + 1 where owner_id = p_owner and day = today and requests < 100 returning requests into quota;
      if not found then return jsonb_build_object('state', 'rate_limited'); end if;
    end if;
    insert into public.nutrition_requests(owner_id, client_id, cache_key, state, result)
      values (p_owner, p_client_id, p_cache_key, 'completed', cached.result)
      on conflict(owner_id, client_id) do update set state = 'completed', result = excluded.result, error_code = null, updated_at = now();
    return jsonb_build_object('state', 'ready', 'estimate', cached.result);
  end if;
  if not p_allow_model then return jsonb_build_object('state', 'disabled'); end if;
  if p_max_cost is null or p_max_cost <= 0 or p_max_cost > 1 then
    raise exception 'invalid maximum call cost' using errcode = '22023';
  end if;
  if existing.client_id is null then
    insert into public.nutrition_daily_usage(owner_id, day) values (p_owner, today) on conflict do nothing;
    update public.nutrition_daily_usage set requests = requests + 1 where owner_id = p_owner and day = today and requests < 100 returning requests into quota;
    if not found then return jsonb_build_object('state', 'rate_limited'); end if;
  end if;
  if cached.state = 'pending' and cached.lease_until > now() then
    insert into public.nutrition_requests(owner_id, client_id, cache_key, state)
      values (p_owner, p_client_id, p_cache_key, 'pending') on conflict do nothing;
    return jsonb_build_object('state', 'pending');
  end if;
  insert into public.nutrition_budgets(month) values (period) on conflict do nothing;
  select * into budget from public.nutrition_budgets where month = period for update;
  if budget.reserved_usd + p_max_cost > budget.limit_usd then
    return jsonb_build_object('state', 'budget_exceeded');
  end if;
  update public.nutrition_budgets set reserved_usd = reserved_usd + p_max_cost where month = period;
  insert into public.nutrition_cache(cache_key, estimator_version, state, lease_token, lease_until)
    values (p_cache_key, p_estimator_version, 'pending', token, now() + interval '2 minutes')
    on conflict(cache_key) do update set state = 'pending', result = null, lease_token = excluded.lease_token, lease_until = excluded.lease_until, updated_at = now();
  insert into public.nutrition_requests(owner_id, client_id, cache_key, state)
    values (p_owner, p_client_id, p_cache_key, 'pending')
    on conflict(owner_id, client_id) do update set state = 'pending', error_code = null, updated_at = now();
  return jsonb_build_object('state', 'claimed', 'leaseToken', token);
end;
$$;

create function public.finish_nutrition_request(p_cache_key text, p_lease_token uuid, p_result jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare field text;
begin
  if jsonb_typeof(p_result->'version') is distinct from 'number' or p_result->>'version' is distinct from '1' or jsonb_typeof(p_result->'model') is distinct from 'string'
    or length(p_result->>'model') not between 1 and 100 or jsonb_typeof(p_result->'assumptions') is distinct from 'array' then
    raise exception 'invalid estimate' using errcode = '22023';
  end if;
  foreach field in array array['kcal', 'protein', 'carbs', 'fat', 'fibre'] loop
    if jsonb_typeof(p_result->field) is distinct from 'number' or (p_result->>field)::numeric < 0
      or (p_result->>field)::numeric > (case when field = 'kcal' then 20000 else 5000 end) then
      raise exception 'invalid estimate nutrition' using errcode = '22023';
    end if;
  end loop;
  if jsonb_array_length(p_result->'assumptions') > 12 or exists (
    select 1 from jsonb_array_elements(p_result->'assumptions') item where jsonb_typeof(item) <> 'string' or length(item#>>'{}') > 300
  ) then raise exception 'invalid estimate assumptions' using errcode = '22023'; end if;
  update public.nutrition_cache set state = 'ready', result = p_result, lease_token = null, lease_until = null, updated_at = now()
    where cache_key = p_cache_key and lease_token = p_lease_token and state = 'pending';
  if not found then return false; end if;
  update public.nutrition_requests set state = 'completed', result = p_result, error_code = null, updated_at = now()
    where cache_key = p_cache_key and state = 'pending';
  return true;
end;
$$;

create function public.fail_nutrition_request(p_cache_key text, p_lease_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.nutrition_cache set state = 'failed', lease_token = null, lease_until = null, updated_at = now()
    where cache_key = p_cache_key and lease_token = p_lease_token and state = 'pending';
  if not found then return false; end if;
  update public.nutrition_requests set state = 'failed', error_code = 'model_failed', updated_at = now() where cache_key = p_cache_key and state = 'pending';
  return true;
end;
$$;

revoke all on function public.claim_nutrition_request(uuid, text, text, text, boolean, numeric) from public, anon, authenticated;
revoke all on function public.finish_nutrition_request(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_nutrition_request(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_nutrition_request(uuid, text, text, text, boolean, numeric) to service_role;
grant execute on function public.finish_nutrition_request(text, uuid, jsonb) to service_role;
grant execute on function public.fail_nutrition_request(text, uuid) to service_role;
