do $$
declare
  a uuid := '00000000-0000-4000-8000-000000000001';
  b uuid := '00000000-0000-4000-8000-000000000002';
  result jsonb;
  token uuid;
  other_token uuid;
  period date := date_trunc('month', timezone('UTC', now()))::date;
  amount numeric;
begin
  insert into public.nutrition_budgets(month) values(period) on conflict do nothing;
  update public.nutrition_budgets set limit_usd = 0, reserved_usd = 0 where month = period;
  update public.nutrition_daily_usage set requests = 0 where owner_id = b;
  result := public.claim_voice_request(a, repeat('9',32), repeat('9',64), false);
  if result->>'state' <> 'disabled' then raise exception 'voice disabled gate failed'; end if;
  result := public.claim_voice_request(a, repeat('9',32), repeat('9',64), true);
  if result->>'state' <> 'budget_exceeded' then raise exception 'voice zero budget failed'; end if;
  update public.nutrition_budgets set limit_usd = 0.09 where month = period;
  result := public.claim_voice_request(a, repeat('9',32), repeat('9',64), true);
  if result->>'state' <> 'claimed' then raise exception 'voice claim failed'; end if;
  token := (result->>'leaseToken')::uuid;
  result := public.claim_voice_request(a, repeat('8',32), repeat('9',64), true);
  if result->>'state' <> 'pending' then raise exception 'voice same-owner single flight failed'; end if;
  if public.finish_voice_request(a,repeat('9',32),gen_random_uuid(),'wrong lease') then raise exception 'voice wrong lease accepted'; end if;
  begin
    perform public.finish_voice_request(a,repeat('9',32),token,repeat('x',501));
    raise exception 'voice invalid transcript accepted';
  exception when invalid_parameter_value then null;
  end;
  if not public.finish_voice_request(a,repeat('9',32),token,'2 roti dal') then raise exception 'voice completion failed'; end if;
  result := public.claim_voice_request(a,repeat('8',32),repeat('9',64),false);
  if result->>'state' <> 'ready' or result->>'transcript' <> '2 roti dal' then raise exception 'coalesced voice completion unavailable'; end if;
  result := public.claim_voice_request(a,repeat('7',32),repeat('9',64),false);
  if result->>'state' <> 'ready' then raise exception 'voice same-owner digest cache missed'; end if;
  select reserved_usd into amount from public.nutrition_budgets where month = period;
  if amount <> 0.04 then raise exception 'voice duplicate charged budget'; end if;
  result := public.claim_voice_request(a,repeat('9',32),repeat('8',64),true);
  if result->>'state' <> 'conflict' then raise exception 'voice identity conflict accepted'; end if;
  result := public.claim_voice_request(b,repeat('9',32),repeat('9',64),true);
  if result->>'state' <> 'claimed' then raise exception 'voice transcript leaked across owners'; end if;
  other_token := (result->>'leaseToken')::uuid;
  if public.finish_voice_request(a,repeat('9',32),other_token,'foreign lease') then raise exception 'cross-owner voice completion accepted'; end if;
  perform public.fail_voice_request(b,repeat('9',32),other_token);
  result := public.claim_nutrition_request(a,repeat('f',32),repeat('f',64),'voice-budget-test',true,0.01);
  if result->>'state' <> 'claimed' then raise exception 'shared nutrition reservation failed'; end if;
  result := public.claim_voice_request(a,repeat('6',32),repeat('6',64),true);
  if result->>'state' <> 'budget_exceeded' then raise exception 'voice exceeded shared cap'; end if;
  select reserved_usd into amount from public.nutrition_budgets where month = period;
  if amount <> 0.09 then raise exception 'voice/text shared ledger incorrect'; end if;
  if has_function_privilege('authenticated','public.claim_voice_request(uuid,text,text,boolean)','execute') then raise exception 'authenticated role can claim voice'; end if;
  if has_table_privilege('authenticated','public.voice_requests','select') then raise exception 'transcript table exposed'; end if;
  if exists(select 1 from storage.buckets where id = 'meal-voice' and public) then raise exception 'voice bucket public'; end if;
  insert into public.voice_requests(owner_id,client_id,audio_sha256,model,pipeline_version,state,transcript)
    values(a,repeat('d',32),repeat('d',64),'gpt-4o-mini-transcribe-2025-12-15','voice-basic-v1','completed','legacy transcript');
  result := public.claim_voice_request(a,repeat('d',32),repeat('d',64),false);
  if result->>'state' <> 'ready' then raise exception 'completed identity changed with pipeline version'; end if;
  result := public.claim_voice_request(a,repeat('c',32),repeat('d',64),false);
  if result->>'state' <> 'disabled' then raise exception 'new pipeline reused stale transcript'; end if;
end;
$$;

insert into storage.objects(bucket_id,name) values('meal-voice','00000000-0000-4000-8000-000000000001/recording.m4a');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$
begin
  if exists(select 1 from storage.objects where bucket_id = 'meal-voice') then raise exception 'cross-owner audio visible'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('meal-voice','00000000-0000-4000-8000-000000000001/injected.m4a');
    raise exception 'cross-owner audio upload accepted';
  exception when insufficient_privilege then null;
  end;
  insert into storage.objects(bucket_id,name) values('meal-voice','00000000-0000-4000-8000-000000000002/own.m4a');
end;
$$;
reset role;
