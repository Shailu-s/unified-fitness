import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createNutritionHandler } from '../_shared/handler.ts';
import { createOpenAIEstimator, OPENAI_NUTRITION_MODEL } from '../_shared/model.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const model = Deno.env.get('NUTRITION_MODEL') ?? OPENAI_NUTRITION_MODEL;
const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
const maximumCost = Number(Deno.env.get('MODEL_MAX_CALL_USD') ?? '0');
const enabled = Deno.env.get('MODEL_API_ENABLED') === 'true' && Boolean(apiKey) && model === OPENAI_NUTRITION_MODEL && Number.isFinite(maximumCost) && maximumCost > 0 && maximumCost <= 1;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(createNutritionHandler({
  model,
  authenticate: async (token) => {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  claim: async (owner, input, key, version) => {
    const { data, error } = await admin.rpc('claim_nutrition_request', {
      p_owner: owner, p_client_id: input.clientId, p_cache_key: key, p_estimator_version: version,
      p_allow_model: enabled, p_max_cost: maximumCost,
    });
    if (error) throw new Error('Backend unavailable.');
    return data;
  },
  finish: async (key, token, result) => {
    const { data, error } = await admin.rpc('finish_nutrition_request', { p_cache_key: key, p_lease_token: token, p_result: result });
    if (error) throw new Error('Could not save result.');
    return data === true;
  },
  fail: async (key, token) => {
    const { error } = await admin.rpc('fail_nutrition_request', { p_cache_key: key, p_lease_token: token });
    if (error) throw new Error('Could not save failure.');
  },
  estimate: createOpenAIEstimator(apiKey, model),
}));
