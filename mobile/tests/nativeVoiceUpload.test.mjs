import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as voice from '../src/lib/voice.ts';
import { VoiceTransportError, processVoiceJobs } from '../src/lib/voiceWorker.ts';
import { NutritionTransportError } from '../src/lib/nutritionWorker.ts';
import { createVoiceHandler } from '../../supabase/functions/_shared/voiceHandler.ts';
import { audioFixture } from './voiceFixture.mjs';
import { open } from './sqlite.mjs';

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputText)((name) => {
    assert.ok(name in dependencies, `Missing dependency ${name}`); return dependencies[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}
const owner = '00000000-0000-4000-8000-000000000001';
const uri = 'file:///documents/ExpoAudio/recording-ABCDEF01-2345-6789-ABCD-EF0123456789.m4a';

function setup(authError = null) {
  const bytes = audioFixture();
  const types = load('../node_modules/expo-crypto/src/Crypto.types.ts', {});
  const crypto = load('../node_modules/expo-crypto/src/Crypto.ts', {
    'expo-modules-core': {}, './Crypto.types': types, './aes': {}, './ExpoCrypto': {
      digest: (_algorithm, output, data) => {
        assert.ok(ArrayBuffer.isView(data), 'Native digest requires TypedArray');
        output.set(createHash('sha256').update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).digest());
      },
    },
  });
  class File {
    constructor(path) { this.uri = path; }
    get exists() { return this.uri === uri; }
    get size() { return bytes.length; }
    async bytes() { return bytes; }
  }
  const files = load('../src/lib/voiceFiles.ts', { 'expo-file-system': { File, Paths: { document: { uri: 'file:///documents' } } }, 'expo-crypto': crypto, './voice': voice });
  const uploads = [];
  const handler = createVoiceHandler({ authenticate: async () => owner, claim: async () => ({ state: 'claimed', leaseToken: 'lease' }),
    load: async () => uploads.at(-1), transcribe: async () => '2 roti dal', finish: async () => true, fail: async () => {}, remove: async () => {} });
  const client = { storage: { from: (bucket) => {
    assert.equal(bucket, 'meal-voice');
    return { list: async () => ({ data: [] }), upload: async (path, body, options) => {
      assert.match(path, new RegExp(`^${owner}/[a-f0-9]{32}\\.m4a$`));
      assert.equal(options.contentType, 'audio/mp4'); uploads.push(new Uint8Array(body)); return {};
    } };
  } } };
  const transport = load('../src/lib/supabaseVoice.ts', {
    './supabaseNutrition': { nutritionSession: async () => { if (authError) throw authError; return { client, token: 'test', owner, config: { url: 'http://localhost', key: 'test' } }; } },
    './voiceFiles': files, './voiceWorker': { VoiceTransportError }, './nutritionWorker': { NutritionTransportError }, './voice': voice,
  }, { process: { env: { EXPO_PUBLIC_VOICE_ENABLED: 'true' } }, fetch: (url, options) => handler(new Request(url, options)) });
  return { files, transport, uploads };
}

test('actual native audio bytes, upload, handler and worker preserve the transcript review boundary', async () => {
  const { files, transport, uploads } = setup();
  const { db, repository } = open();
  try {
    const audio = await files.voiceAudioData(uri);
    assert.equal(audio.durationMs, 2000);
    assert.equal(audio.sha256, createHash('sha256').update(audio.bytes).digest('hex'));
    const recording = repository.startVoiceRecording(uri);
    repository.queueVoiceRecording(recording.id, audio.durationMs);
    await processVoiceJobs(repository, transport.requestVoice, () => {}, () => true);
    assert.equal(repository.getVoiceJob(recording.id).transcript, '2 roti dal');
    assert.equal(repository.getNutritionJobs().length, 0);
    assert.equal(uploads.length, 1);
    const meal = repository.reviewVoiceTranscript(recording.id, '2 roti and dal');
    assert.equal(meal.logState, 'draft');
    assert.equal(repository.getNutritionJobs().length, 1);
  } finally { db.close(); }
});

test('retryable auth failures remain offline voice retries instead of permanent setup errors', async () => {
  const { transport } = setup(new NutritionTransportError('network'));
  await assert.rejects(transport.requestVoice({ audioUri: uri }), (error) => error instanceof VoiceTransportError && error.code === 'network');
});
