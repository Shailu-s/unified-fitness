import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { validateSupabaseConfig } from '../src/lib/supabaseConfig.ts';
import { createSecureSessionStorage } from '../src/lib/secureSessionStorage.ts';
import { processNutritionJobs, NutritionTransportError } from '../src/lib/nutritionWorker.ts';
import { open } from './sqlite.mjs';

const input = { name: '2 roti dal chawal', portion: '1 katori', kcal: null, protein: null, fibre: null };
const estimate = { version: 1, model: 'test-fixture', kcal: 610, protein: 22, carbs: 90, fat: 16, fibre: 10, assumptions: [] };
const now = new Date('2026-10-05T06:00:00Z');
const jwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;

test('public config rejects privileged keys and API-path URLs without exposing values', () => {
  assert.equal(validateSupabaseConfig(undefined, undefined), null);
  assert.equal(validateSupabaseConfig('https://project.supabase.co', 'sb_publishable_test').enabled, false);
  assert.equal(validateSupabaseConfig('https://project.supabase.co', jwt('anon'), 'true').enabled, true);
  for (const key of ['sb_secret_fake-fixture', jwt('service_role')]) assert.throws(() => validateSupabaseConfig('https://project.supabase.co', key), /Privileged/);
  assert.throws(() => validateSupabaseConfig('https://project.supabase.co/rest/v1/', 'sb_publishable_test'));
  assert.throws(() => validateSupabaseConfig('ftp://localhost', 'sb_publishable_test'));
});

test('live smoke refuses to register users or call inference without explicit approval', () => {
  const result = spawnSync(process.execPath, [new URL('../scripts/smoke-nutrition.mjs', import.meta.url).pathname], {
    env: { ...process.env, NUTRITION_SMOKE_APPROVED: 'false' }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Explicit live-test spending approval required/);
  assert.equal(result.stdout.includes('Guest authentication'), false);
});

function secureStore() {
  const values = new Map();
  let id = 0;
  const adapter = { get: async (key) => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); }, remove: async (key) => { values.delete(key); } };
  return { values, adapter, storage: createSecureSessionStorage(adapter, () => `test-${++id}`) };
}

test('encrypted storage adapter chunks large sessions and survives instance restart', async () => {
  const { values, adapter, storage } = secureStore();
  const value = JSON.stringify({ token: 'x'.repeat(4000), text: 'रोटी 🍛'.repeat(200) });
  await storage.setItem('session', value);
  assert.equal(await storage.getItem('session'), value);
  assert.ok([...values.values()].every((chunk) => new TextEncoder().encode(chunk).length <= 2048));
  assert.equal(await createSecureSessionStorage(adapter, () => 'unused').getItem('session'), value);
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
});

test('failed session write retains previous complete session and serial reads do not observe partial tokens', async () => {
  const { adapter, storage } = secureStore();
  await storage.setItem('session', 'old-session');
  const original = adapter.set;
  adapter.set = async (key, value) => { if (key.includes('test-2.1')) throw new Error('Storage full'); await original(key, value); };
  await assert.rejects(storage.setItem('session', 'new'.repeat(1000)), /Storage full/);
  assert.equal(await storage.getItem('session'), 'old-session');
  adapter.set = original;
  const results = await Promise.all([storage.setItem('session', 'complete-new'), storage.getItem('session')]);
  assert.equal(results[1], 'complete-new');
});

test('worker processes text, skips unsupported photos, and persists complete estimates', async () => {
  const { db, repository } = open();
  try {
    repository.addMeal({ ...input, inputType: 'photo', photoUri: 'file:///documents/fixture.jpg' }, now);
    const meal = repository.addMeal(input, now);
    let calls = 0;
    await processNutritionJobs(repository, async () => { calls++; return { state: 'ready', estimate }; }, () => {}, () => true, () => now);
    assert.equal(calls, 1);
    const meals = repository.getMeals(meal.loggedDate);
    assert.equal(meals.find((m) => m.inputType === 'photo').estimateState, 'queued');
    assert.equal(meals.find((m) => m.id === meal.id).nutritionStatus, 'estimated');
  } finally { db.close(); }
});

test('paused worker does not claim jobs or invoke remote auth/inference', async () => {
  const { db, repository } = open();
  try {
    repository.addMeal(input, now);
    await processNutritionJobs(repository, async () => { throw new Error('Should not call'); }, () => {}, () => false, () => now);
    assert.equal(repository.getNutritionJobs()[0].attempts, 0);
  } finally { db.close(); }
});

test('pending response returns job to queue; backend failure keeps meal saved', async () => {
  const { db, repository } = open();
  try {
    const meal = repository.addMeal(input, now);
    await processNutritionJobs(repository, async () => ({ state: 'pending', retryAfter: 5 }), () => {}, () => true, () => now);
    assert.equal(repository.getNutritionJobs()[0].state, 'queued');
    await processNutritionJobs(repository, async () => { throw new NutritionTransportError('backend_not_configured'); }, () => {}, () => true, () => new Date(now.getTime() + 6000));
    assert.equal(repository.getMeals(meal.loggedDate)[0].estimateState, 'failed');
    assert.equal(repository.getNutritionJobs()[0].errorCode, 'backend_not_configured');
  } finally { db.close(); }
});
