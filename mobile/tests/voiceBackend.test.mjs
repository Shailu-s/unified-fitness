import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createVoiceHandler, createVoiceTranscriber } from '../../supabase/functions/_shared/voiceHandler.ts';
import { VOICE_MODEL, VOICE_PROMPT, voiceObjectPath } from '../src/lib/voice.ts';
import { audioFixture } from './voiceFixture.mjs';

const owner = '00000000-0000-4000-8000-000000000001';
const bytes = audioFixture();
const input = { clientId: 'a'.repeat(32), audioSha256: createHash('sha256').update(bytes).digest('hex') };
function setup(overrides = {}) {
  const events = [];
  const handler = createVoiceHandler({
    authenticate: async () => owner,
    claim: async (uid, body) => { events.push({ uid, body }); return { state: 'claimed', leaseToken: 'lease' }; },
    load: async (uid, id) => { events.push({ uid, id }); return bytes; },
    transcribe: async () => { events.push('model'); return 'दो रोटी और दाल'; },
    finish: async () => { events.push('finish'); return true; }, fail: async () => { events.push('fail'); },
    remove: async (uid, id) => { events.push({ removed: voiceObjectPath(uid, id) }); }, ...overrides,
  });
  return { events, request: (body = input, token = 'test-token') => handler(new Request('http://localhost/voice', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) })) };
}

test('voice auth/input checks reject spoofed owners, URLs and unknown fields before model work', async () => {
  const { request, events } = setup();
  assert.equal((await request(input, '')).status, 401);
  for (const extra of [{ owner }, { url: 'https://example.com/audio.m4a' }, { model: 'other' }, { inputType: 'photo' }]) assert.equal((await request({ ...input, ...extra })).status, 422);
  assert.equal((await request({ ...input, audioSha256: 'wrong' })).status, 422);
  assert.deepEqual(events, []);
});

test('voice pipeline derives private owner path, validates digest, saves transcript and removes upload', async () => {
  const { request, events } = setup();
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).transcript, 'दो रोटी और दाल');
  assert.equal(events[0].uid, owner);
  assert.ok(events.includes('model'));
  assert.ok(events.includes('finish'));
  assert.deepEqual(events.at(-1), { removed: `${owner}/${input.clientId}.m4a` });
});

test('voice cache/idempotent responses bypass audio fetch and inference', async () => {
  const { request, events } = setup({ claim: async () => ({ state: 'ready', transcript: '2 roti dal' }) });
  assert.equal((await request()).status, 200);
  assert.deepEqual(events, [{ removed: `${owner}/${input.clientId}.m4a` }]);
});

test('disabled, budget, pending and rate states never invoke transcription', async () => {
  for (const state of ['disabled','budget_exceeded','pending','rate_limited']) {
    const { request, events } = setup({ claim: async () => ({ state }) });
    const response = await request();
    assert.ok([202,429,503].includes(response.status));
    assert.equal(events.includes('model'), false);
    if (state === 'pending') assert.deepEqual(events, []);
  }
});

test('tampered, oversized, malformed or long audio cannot reach the model', async () => {
  for (const data of [audioFixture(90), new Uint8Array(1000001), new Uint8Array([1,2,3]), audioFixture(3)]) {
    const { request, events } = setup({ load: async () => data });
    const response = await request();
    assert.equal((await response.json()).error, 'audio_invalid');
    assert.equal(events.includes('model'), false);
    assert.ok(events.includes('fail'));
    assert.deepEqual(events.at(-1), { removed: `${owner}/${input.clientId}.m4a` });
  }
});

test('silence/invalid transcript fails explicitly without completing a fabricated meal', async () => {
  const { request, events } = setup({ transcribe: async () => '' });
  assert.equal((await (await request()).json()).error, 'invalid_result');
  assert.equal(events.includes('finish'), false);
  assert.ok(events.includes('fail'));
});

test('OpenAI transcription uses pinned model, inline M4A, no client secrets or unsupported store parameter', async () => {
  const transcribe = createVoiceTranscriber('fake-test-key', async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions');
    assert.equal(init.headers.Authorization, 'Bearer fake-test-key');
    assert.equal(init.body.get('model'), VOICE_MODEL);
    assert.equal(init.body.get('prompt'), VOICE_PROMPT);
    assert.equal(init.body.get('file').type, 'audio/mp4');
    assert.deepEqual(new Uint8Array(await init.body.get('file').arrayBuffer()), bytes);
    assert.equal(init.body.has('store'), false);
    assert.equal(init.body.get('response_format'), 'json');
    return Response.json({ text: '  two roti and dal  ' });
  });
  assert.equal(await transcribe(bytes), 'two roti and dal');
  await assert.rejects(createVoiceTranscriber('', async () => { throw new Error('Must not call'); })(bytes));
  await assert.rejects(createVoiceTranscriber('fake', async () => Response.json({ text: '' }))(bytes), /invalid_result/);
});
