import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNutritionHandler } from '../../supabase/functions/_shared/handler.ts';
import { createGeminiEstimator } from '../../supabase/functions/_shared/model.ts';

const estimate = { version: 1, model: 'test-fixture', kcal: 610, protein: 22, carbs: 90, fat: 16, fibre: 10, assumptions: ['Test fixture only'] };
const input = { clientId: 'a'.repeat(32), inputType: 'text', name: '2 roti dal chawal', portion: '1 katori' };
function setup(overrides = {}) {
  const events = [];
  const handler = createNutritionHandler({
    model: 'test-fixture',
    authenticate: async (token) => token === 'test-token' ? 'owner-fixture' : null,
    claim: async (owner, body, key, version) => { events.push({ owner, body, key, version }); return { state: 'claimed', leaseToken: 'lease-fixture' }; },
    finish: async () => { events.push('finish'); return true; },
    fail: async () => { events.push('fail'); },
    estimate: async () => { events.push('model'); return estimate; },
    ...overrides,
  });
  const request = (body = input, token = 'test-token') => handler(new Request('http://localhost/nutrition', {
    method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  }));
  return { events, request, handler };
}

test('unauthenticated callers cannot reach database or model', async () => {
  const { request, events } = setup();
  assert.equal((await request(input, 'invalid')).status, 401);
  assert.deepEqual(events, []);
});

test('client cannot spoof owner, cache key, upload path or unsupported input type', async () => {
  const { request, events } = setup();
  for (const body of [{ ...input, ownerId: 'other' }, { ...input, cacheKey: 'guessed' }, { ...input, photoUri: 'file:///private.jpg' },
    { ...input, inputType: 'photo' }, { ...input, name: '' }, { ...input, name: 'a'.repeat(501) }, { ...input, clientId: 'bad' }]) {
    assert.equal((await request(body)).status, 422);
  }
  assert.deepEqual(events, []);
});

test('oversized streamed body is rejected without database/model work', async () => {
  const { handler, events } = setup();
  const response = await handler(new Request('http://localhost/nutrition', {
    method: 'POST', headers: { authorization: 'Bearer test-token' }, body: 'x'.repeat(9000),
  }));
  assert.equal(response.status, 413);
  assert.deepEqual(events, []);
});

test('ready shared cache bypasses model and uses validated data', async () => {
  const { request, events } = setup({ claim: async () => ({ state: 'ready', estimate }) });
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { state: 'ready', estimate });
  assert.deepEqual(events, []);
});

test('pending, disabled, budget and rate states never invoke model', async () => {
  for (const [state, expected] of [['pending', 202], ['disabled', 503], ['budget_exceeded', 429], ['rate_limited', 429], ['conflict', 409]]) {
    const { request, events } = setup({ claim: async () => ({ state }) });
    assert.equal((await request()).status, expected);
    assert.deepEqual(events, []);
  }
});

test('normalization is quantity-safe and model-specific; owner comes only from authentication', async () => {
  const a = setup(); const b = setup(); const c = setup();
  await a.request();
  await b.request({ ...input, name: '  2 ROTI  dal chawal ', portion: '1  KATORI' });
  await c.request({ ...input, name: '1 roti dal chawal' });
  assert.equal(a.events[0].owner, 'owner-fixture');
  assert.match(a.events[0].key, /^[a-f0-9]{64}$/);
  assert.equal(a.events[0].key, b.events[0].key);
  assert.notEqual(a.events[0].key, c.events[0].key);
});

test('invalid or failed model output is never completed or returned as nutrition', async () => {
  const { request, events } = setup({ estimate: async () => ({ ...estimate, kcal: -1 }) });
  const response = await request();
  assert.equal(response.status, 502);
  assert.equal(events.includes('finish'), false);
  assert.equal(events.includes('fail'), true);
  assert.deepEqual(await response.json(), { error: 'model_failed' });
});

test('model boundary sends structured bounded request without putting API key in URL', async () => {
  let observed;
  const model = createGeminiEstimator('fake-test-key', 'gemini-test-fixture', async (url, options) => {
    observed = { url, options };
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(estimate) }] } }] });
  });
  assert.deepEqual(await model(input), { ...estimate, model: 'gemini-test-fixture' });
  assert.equal(observed.url.includes('fake-test-key'), false);
  const body = JSON.parse(observed.options.body);
  assert.equal(body.generationConfig.maxOutputTokens, 2048);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(observed.options.headers['x-goog-api-key'], 'fake-test-key');
});

test('model boundary rejects truncated output and missing model configuration', async () => {
  await assert.rejects(createGeminiEstimator('', 'unconfigured')(input), /configured/);
  await assert.rejects(createGeminiEstimator('fake', 'gemini-test-fixture', async () => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }))(input), /Incomplete/);
});
