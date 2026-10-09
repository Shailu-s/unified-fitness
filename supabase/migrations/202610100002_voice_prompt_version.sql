alter table public.voice_requests add column pipeline_version text not null default 'voice-basic-v1';
alter table public.voice_requests alter column pipeline_version set default 'indian-meal-v1';

create or replace function public.claim_voice_request(p_owner uuid, p_client_id text, p_digest text, p_allow_model boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing public.voice_requests%rowtype;
  cached public.voice_requests%rowtype;
  quota integer;
  budget public.nutrition_budgets%rowtype;
  period date := date_trunc('month', timezone('UTC', now()))::date;
  today date := timezone('UTC', now())::date;
  token uuid := gen_random_uuid();
  pinned_model text := 'gpt-4o-mini-transcribe-2025-12-15';
  pipeline text := 'indian-meal-v1';
begin
  if p_owner is null or p_client_id is null or p_client_id !~ '^[a-f0-9]{32}$'
    or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_allow_model is null then
    raise exception 'invalid voice identifiers' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || ':' || p_client_id, 1));
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || ':' || p_digest || ':' || pinned_model || ':' || pipeline, 0));
  select * into existing from public.voice_requests where owner_id = p_owner and client_id = p_client_id;
  if found and existing.audio_sha256 <> p_digest then return jsonb_build_object('state','conflict'); end if;
  if existing.state = 'completed' then return jsonb_build_object('state','ready','transcript',existing.transcript); end if;
  if existing.client_id is not null and existing.pipeline_version <> pipeline then return jsonb_build_object('state','conflict'); end if;
  if existing.client_id is null then
    insert into public.nutrition_daily_usage(owner_id, day) values (p_owner, today) on conflict do nothing;
    update public.nutrition_daily_usage set requests = requests + 1 where owner_id = p_owner and day = today and requests < 100 returning requests into quota;
    if not found then return jsonb_build_object('state','rate_limited'); end if;
  end if;
  select * into cached from public.voice_requests where owner_id = p_owner and audio_sha256 = p_digest and model = pinned_model and pipeline_version = pipeline and state = 'completed' limit 1;
  if cached.client_id is not null then
    insert into public.voice_requests(owner_id,client_id,audio_sha256,model,pipeline_version,state,transcript)
      values(p_owner,p_client_id,p_digest,pinned_model,pipeline,'completed',cached.transcript)
      on conflict(owner_id,client_id) do update set state = 'completed', transcript = excluded.transcript, lease_token = null, lease_until = null, updated_at = now();
    return jsonb_build_object('state','ready','transcript',cached.transcript);
  end if;
  if not p_allow_model then return jsonb_build_object('state','disabled'); end if;
  select * into cached from public.voice_requests where owner_id = p_owner and audio_sha256 = p_digest and model = pinned_model and pipeline_version = pipeline and state = 'pending' and lease_until > now() limit 1;
  if cached.client_id is not null then
    insert into public.voice_requests(owner_id,client_id,audio_sha256,model,pipeline_version,state,lease_token,lease_until)
      values(p_owner,p_client_id,p_digest,pinned_model,pipeline,'pending',cached.lease_token,cached.lease_until) on conflict do nothing;
    return jsonb_build_object('state','pending');
  end if;
  insert into public.nutrition_budgets(month) values(period) on conflict do nothing;
  select * into budget from public.nutrition_budgets where month = period for update;
  if budget.reserved_usd + 0.04 > budget.limit_usd then return jsonb_build_object('state','budget_exceeded'); end if;
  update public.nutrition_budgets set reserved_usd = reserved_usd + 0.04 where month = period;
  insert into public.voice_requests(owner_id,client_id,audio_sha256,model,pipeline_version,state,lease_token,lease_until)
    values(p_owner,p_client_id,p_digest,pinned_model,pipeline,'pending',token,now() + interval '2 minutes')
    on conflict(owner_id,client_id) do update set state = 'pending', lease_token = excluded.lease_token, lease_until = excluded.lease_until, updated_at = now();
  update public.voice_requests set state = 'pending', lease_token = token, lease_until = now() + interval '2 minutes', updated_at = now()
    where owner_id = p_owner and audio_sha256 = p_digest and model = pinned_model and pipeline_version = pipeline and state <> 'completed';
  return jsonb_build_object('state','claimed','leaseToken',token);
end;
$$;

revoke all on function public.claim_voice_request(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.claim_voice_request(uuid,text,text,boolean) to service_role;
