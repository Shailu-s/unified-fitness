import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNutritionHandler } from '../../supabase/functions/_shared/handler.ts';
import { createOpenAIEstimator, OPENAI_NUTRITION_MODEL } from '../../supabase/functions/_shared/model.ts';

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

const completed = (content) => ({ status: 'completed', output: [{ type: 'message', content }] });
const outputText = () => ({ type: 'output_text', text: JSON.stringify(estimate) });

test('OpenAI boundary sends pinned, bounded strict JSON request with storage disabled and no key in URL', async () => {
  let observed;
  const model = createOpenAIEstimator('fake-test-key', OPENAI_NUTRITION_MODEL, async (url, options) => {
    observed = { url, options };
    return Response.json(completed([outputText()]));
  });
  assert.deepEqual(await model(input), { ...estimate, model: OPENAI_NUTRITION_MODEL });
  assert.equal(observed.url, 'https://api.openai.com/v1/responses');
  assert.equal(observed.url.includes('fake-test-key'), false);
  const body = JSON.parse(observed.options.body);
  assert.equal(body.model, OPENAI_NUTRITION_MODEL);
  assert.equal(body.max_output_tokens, 2048);
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.strict, true);
  assert.equal(body.store, false);
  assert.equal(body.reasoning.effort, 'low');
  assert.equal(observed.options.headers.Authorization, 'Bearer fake-test-key');
});

test('OpenAI boundary rejects refusal, truncation, empty output, invalid JSON and missing config', async () => {
  await assert.rejects(createOpenAIEstimator('', OPENAI_NUTRITION_MODEL)(input), /configured/);
  await assert.rejects(createOpenAIEstimator('fake', 'unsupported-model')(input), /configured/);
  for (const response of [
    { status: 'incomplete', output: [] },
    completed([{ type: 'refusal', refusal: 'test refusal' }]),
    completed([]),
    completed([{ type: 'output_text', text: 'invalid JSON' }]),
  ]) await assert.rejects(createOpenAIEstimator('fake', OPENAI_NUTRITION_MODEL, async () => Response.json(response))(input));
});

test('OpenAI image input is inline and bounded; URLs and unsupported image formats are not accepted', async () => {
  let observed;
  const model = createOpenAIEstimator('fake', OPENAI_NUTRITION_MODEL, async (_url, options) => {
    observed = JSON.parse(options.body);
    return Response.json(completed([outputText()]));
  });
  await model(input, { mimeType: 'image/jpeg', base64: 'AAEC' });
  assert.equal(observed.input[0].content[1].type, 'input_image');
  assert.equal(observed.input[0].content[1].image_url, 'data:image/jpeg;base64,AAEC');
  await assert.rejects(model(input, { mimeType: 'image/svg+xml', base64: 'AAEC' }), /image/);
  await assert.rejects(model(input, { mimeType: 'image/jpeg', base64: 'https://example.com/photo.jpg' }), /image/);
  await assert.rejects(model(input, { mimeType: 'image/jpeg', base64: 'A'.repeat(2800004) }), /image/);
});
