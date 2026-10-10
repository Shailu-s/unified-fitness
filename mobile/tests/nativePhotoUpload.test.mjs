import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as photos from '../src/lib/photos.ts';
import * as nutrition from '../src/lib/nutrition.ts';
import { NutritionTransportError, processNutritionJobs } from '../src/lib/nutritionWorker.ts';
import { open } from './sqlite.mjs';

const jpeg = Uint8Array.from([255,216,255,225,0,8,69,120,105,102,0,0,255,219,0,4,1,2,255,218,0,2,9,255,217]);
const root = 'file:///documents/meal-photos';
const uuid = '01234567-89ab-4cde-8f01-23456789abcd';

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputText)((name) => {
    assert.ok(name in dependencies, `Missing test dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

function setup(authOverride = null) {
  const events = [];
  const files = new Map();
  class Directory {
    constructor() { this.uri = root; }
    create() {}
  }
  class File {
    constructor(folder, name) { this.uri = name ? `${folder.uri}/${name}` : folder; }
    create() { files.set(this.uri, new Uint8Array()); }
    write(bytes) { files.set(this.uri, bytes); }
    async bytes() { assert.ok(files.has(this.uri)); return files.get(this.uri); }
  }
  files.set('file:///cache/prepared.jpg', jpeg);
  const types = load('../node_modules/expo-crypto/src/Crypto.types.ts', {});
  const crypto = load('../node_modules/expo-crypto/src/Crypto.ts', {
    'expo-modules-core': {}, './Crypto.types': types, './aes': {},
    './ExpoCrypto': { randomUUID: () => uuid, digest: (_algorithm, output, data) => {
      events.push('native-digest');
      if (!ArrayBuffer.isView(data)) throw new TypeError('Native TypedArray conversion rejects ArrayBuffer');
      output.set(createHash('sha256').update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).digest());
    } },
  });
  const asset = { uri: 'file:///cache/picked.jpg', width: 640, height: 480 };
  const imagePicker = {
    requestCameraPermissionsAsync: async () => { events.push('camera-permission'); return { granted: true }; },
    launchCameraAsync: async () => { events.push('camera'); return { canceled: false, assets: [asset] }; },
    launchImageLibraryAsync: async () => { events.push('gallery'); return { canceled: false, assets: [asset] }; },
  };
  const photoFiles = load('../src/lib/photoFiles.ts', {
    'expo-image-picker': imagePicker,
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({ renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///cache/prepared.jpg' }) }) }) } },
    'expo-file-system': { Directory, File, Paths: { document: 'file:///documents' } }, 'expo-crypto': crypto, './photos': photos,
  });
  const client = {
    auth: authOverride ?? { getSession: async () => ({ data: { session: { access_token: 'test-token', expires_at: 9999999999, user: { id: 'test-owner' } } } }) },
    storage: { from: () => ({ list: async () => ({ data: [] }), upload: async () => { events.push('upload'); return {}; } }) },
  };
  const transport = load('../src/lib/supabaseNutrition.ts', {
    'react-native-url-polyfill/auto': {}, '@supabase/supabase-js': { createClient: () => client }, 'expo-secure-store': {},
    './secureSessionStorage': { createSecureSessionStorage: () => ({}) }, './supabaseConfig': { validateSupabaseConfig: () => ({ enabled: true, url: 'http://localhost', key: 'test-key' }) },
    './nutritionWorker': { NutritionTransportError }, './nutrition': nutrition, './photoFiles': photoFiles,
  }, { process: { env: { EXPO_PUBLIC_PHOTO_ESTIMATES_ENABLED: 'true' } }, fetch: async () => {
    events.push('estimate-request');
    return Response.json({ state: 'ready', estimate: { version: 1, model: 'test-fixture', kcal: 500, protein: 20, carbs: 60, fat: 20, fibre: 5, assumptions: [], foods: [{ name: 'Dal and roti', portion: '1 bowl and 2 roti' }] } });
  } });
  return { photoFiles, transport, events };
}

test('actual capture/upload/worker path respects the iOS Expo Crypto TypedArray contract', async () => {
  const { photoFiles, transport, events } = setup();
  const { db, repository } = open();
  try {
    const uri = await photoFiles.pickMealPhoto('camera');
    const meal = repository.addPhotoDraft({ name: '', portion: '', kcal: null, protein: null, fibre: null, inputType: 'photo', photoUri: uri });
    await processNutritionJobs(repository, transport.requestNutrition, () => {}, () => true, () => new Date(), ['photo']);
    const result = repository.getMeal(meal.id);
    assert.equal(result.estimateError, null);
    assert.equal(result.nutritionStatus, 'estimated');
    assert.equal(result.kcal, 500);
    assert.ok(events.includes('upload'));
    assert.ok(events.includes('estimate-request'));
  } finally { db.close(); }
});

test('native upload digest covers the sanitized JPEG bytes, identical to the server SHA-256', async () => {
  const { photoFiles } = setup();
  const uri = await photoFiles.pickMealPhoto('gallery');
  const photo = await photoFiles.photoUploadData(uri);
  assert.deepEqual(photo.bytes, photos.stripJpegMetadata(jpeg));
  assert.equal(photo.sha256, createHash('sha256').update(photo.bytes).digest('hex'));
});

test('direct CameraView pictures use the same sanitized durable photo upload pipeline', async () => {
  const { photoFiles, events } = setup();
  const uri = await photoFiles.prepareMealPhoto({ uri: 'file:///cache/camera-view.jpg', width: 640, height: 480 });
  assert.equal(uri, `${root}/${uuid}.jpg`);
  const photo = await photoFiles.photoUploadData(uri);
  assert.equal(new TextDecoder().decode(photo.bytes).includes('Exif'), false);
  assert.equal(photo.sha256, createHash('sha256').update(photo.bytes).digest('hex'));
  assert.equal(events.includes('camera'), false);
  assert.equal(events.includes('gallery'), false);
});

test('concurrent voice/nutrition session requests create only one guest identity', async () => {
  let signedIn = false;
  let calls = 0;
  const session = { access_token: 'test-token', expires_at: 9999999999, user: { id: 'test-owner' } };
  const { transport } = setup({
    getSession: async () => ({ data: { session: signedIn ? session : null } }),
    signInAnonymously: async () => { calls++; await Promise.resolve(); signedIn = true; return {}; },
  });
  const [first, second] = await Promise.all([transport.nutritionSession(), transport.nutritionSession()]);
  assert.equal(calls, 1);
  assert.equal(first.owner, second.owner);
  assert.equal(first.token, second.token);
});

test('actual gallery capture works without requesting camera permission', async () => {
  const { photoFiles, events } = setup();
  assert.equal(await photoFiles.pickMealPhoto('gallery'), `${root}/${uuid}.jpg`);
  assert.ok(events.includes('gallery'));
  assert.equal(events.includes('camera-permission'), false);
  assert.equal(events.includes('camera'), false);
});
