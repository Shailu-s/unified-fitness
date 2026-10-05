import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validateSupabaseConfig } from '../src/lib/supabaseConfig.ts';
import { validateEstimate } from '../src/lib/nutrition.ts';

if (process.env.NUTRITION_SMOKE_APPROVED !== 'true') throw new Error('Explicit live-test spending approval required.');

const config = validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
if (!config) throw new Error('Supabase public config missing.');
const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInAnonymously();
if (signedIn.error || !signedIn.data.session) throw new Error('Anonymous sign-in failed; check project auth configuration.');
console.log('Guest authentication: passed');
const token = signedIn.data.session.access_token;
const clientId = randomBytes(16).toString('hex');

async function estimate(id, name, accessToken = token) {
  const response = await fetch(`${config.url}/functions/v1/nutrition-estimate`, {
    method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: id, inputType: 'text', name, portion: '2 medium roti and 1 katori dal' }),
    signal: AbortSignal.timeout(65000),
  });
  const body = await response.json();
  if (!response.ok || body.state !== 'ready') throw new Error(`Estimate HTTP ${response.status}, state ${body.state ?? body.error ?? body.code ?? 'unknown'}`);
  return validateEstimate(body.estimate);
}

const first = await estimate(clientId, '2 medium roti, 1 katori dal');
console.log('First estimate response: passed (may be cached)');
console.log('Unvalidated nutrition estimate:', JSON.stringify(first));
const sameJob = await estimate(clientId, '2 medium roti, 1 katori dal');
assert.deepEqual(sameJob, first);
console.log('Same-job idempotency: passed');
const repeated = await estimate(randomBytes(16).toString('hex'), '  2 MEDIUM  roti, 1 katori dal  ');
assert.deepEqual(repeated, first);
console.log('Normalized repeated meal consistency: passed');
const otherClient = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
const otherGuest = await otherClient.auth.signInAnonymously();
if (otherGuest.error || !otherGuest.data.session) throw new Error('Second guest authentication failed.');
const shared = await estimate(randomBytes(16).toString('hex'), '2 medium roti, 1 katori dal', otherGuest.data.session.access_token);
assert.deepEqual(shared, first);
console.log('Cross-user shared-cache result: passed');
