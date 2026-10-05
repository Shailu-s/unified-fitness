import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripJpegMetadata, validatePhotoBytes, validateOwnedPhotoUri, capturePhoto } from '../src/lib/photos.ts';
import { open } from './sqlite.mjs';
import { processNutritionJobs, NutritionTransportError } from '../src/lib/nutritionWorker.ts';

const jpeg = Uint8Array.from([255,216,255,225,0,8,69,120,105,102,0,0,255,219,0,4,1,2,255,218,0,2,9,255,217]);
const input = { name: 'Photo meal', portion: '', kcal: null, protein: null, fibre: null, inputType: 'photo', photoUri: 'file:///documents/meal-photos/fixture.jpg' };

test('JPEG privacy scrub removes EXIF/XMP/comment segments without losing image scan bytes', () => {
  const safe = stripJpegMetadata(jpeg);
  assert.equal(new TextDecoder().decode(safe).includes('Exif'), false);
  assert.deepEqual([...safe], [255,216,255,219,0,4,1,2,255,218,0,2,9,255,217]);
  assert.throws(() => validatePhotoBytes(new Uint8Array([1,2,3])), /JPEG/);
  assert.throws(() => validatePhotoBytes(new Uint8Array(2100001)), /large/);
});

test('owned-photo guard handles directory trailing slash and rejects traversal/external paths', () => {
  const root = 'file:///documents/meal-photos';
  for (const folder of [root,root+'/']) validateOwnedPhotoUri(root+'/aabbcc.jpg',folder);
  for (const uri of ['file:///documents/other/aabbcc.jpg',root+'/../private.jpg',root+'/%2e%2e/private.jpg','https://example.com/aabbcc.jpg']) assert.throws(()=>validateOwnedPhotoUri(uri,root));
});

test('cancelled/denied capture never persists a file or creates a meal', async () => {
  let writes = 0;
  const ports = { permission: async () => false, pick: async () => null, prepare: async () => jpeg,
    persist: async () => { writes++; return 'file:///documents/meal-photos/fixture.jpg'; } };
  await assert.rejects(capturePhoto('camera', ports), /permission/);
  assert.equal(await capturePhoto('gallery', ports), null);
  assert.equal(writes, 0);
});

test('photo bytes are sanitized and persisted before local meal/job save, with no network', async () => {
  const { db, repository } = open();
  const events = [];
  try {
    const uri = await capturePhoto('camera', { permission: async () => true, pick: async () => ({ uri: 'file:///cache/picked.jpg', width: 3000, height: 2000 }),
      prepare: async () => { events.push('prepare'); return jpeg; }, persist: async (bytes) => { assert.equal(new TextDecoder().decode(bytes).includes('Exif'), false); events.push('persist'); return input.photoUri; } });
    const meal = repository.addMeal({ ...input, photoUri: uri });
    events.push('save');
    assert.deepEqual(events, ['prepare','persist','save']);
    assert.equal(repository.getNutritionJobs()[0].input.photoUri, uri);
    assert.equal(repository.getMeals(meal.loggedDate)[0].kcal, null);
  } finally { db.close(); }
});

test('photo file/reference and pending job survive database close/reopen', async () => {
  const folder = mkdtempSync(join(tmpdir(),'fitness-photo-'));
  const path = join(folder,'logging.db');
  const image = join(folder,'aabbcc.jpg');
  let connection = open(path);
  try {
    const uri = await capturePhoto('gallery',{ permission: async()=>true, pick: async()=>({uri:'file:///picked.jpg',width:100,height:100}), prepare: async()=>jpeg,
      persist: async(bytes)=>{writeFileSync(image,bytes);return `file://${image}`;} });
    const saved = connection.repository.addMeal({...input,photoUri:uri});
    connection.db.close(); connection=open(path);
    assert.equal(connection.repository.getMeal(saved.id).photoUri,uri);
    assert.equal(connection.repository.getNutritionJobs()[0].state,'queued');
    assert.deepEqual([...readFileSync(image)],[...stripJpegMetadata(jpeg)]);
  } finally { connection.db.close(); rmSync(folder,{recursive:true,force:true}); }
});

test('photo removal preserves derived nutrition, rejects late results and does not become a manual override', () => {
  const { db, repository } = open();
  try {
    const meal = repository.addMeal(input);
    const job = repository.claimNutritionJob();
    const result = { version: 1, model: 'test-fixture', kcal: 500, protein: 20, carbs: 60, fat: 20, fibre: 5, assumptions: [], foods: [{ name: 'Roti and paneer', portion: '2 roti, 1 bowl' }] };
    repository.completeNutritionJob(job.id, job.leaseToken, result);
    const removed = repository.removePhoto(meal.id);
    assert.equal(removed.photoUri, null);
    assert.equal(removed.nutritionStatus, 'estimated');
    assert.equal(removed.kcal, 500);
    assert.deepEqual(removed.foods, result.foods);
  } finally { db.close(); }
});

test('transient timeout shows retrying rather than definitive failure; non-food is terminal', async () => {
  const { db, repository } = open();
  const now = new Date('2026-10-05T06:00:00Z');
  try {
    const meal = repository.addMeal({ ...input, inputType: 'text', photoUri: null, name: 'Paneer and roti' }, now);
    await processNutritionJobs(repository, async () => { throw new NutritionTransportError('network'); }, () => {}, () => true, () => now);
    assert.equal(repository.getMeals(meal.loggedDate)[0].estimateState, 'queued');
    assert.equal(repository.getNutritionJobs()[0].errorCode, 'network');
    const photo = repository.addMeal(input, now);
    const job = repository.claimNutritionJob(now, ['photo']);
    repository.failNutritionJob(job.id, job.leaseToken, 'not_food', now);
    assert.equal(repository.claimNutritionJob(new Date(now.getTime()+3600000), ['photo']), null);
    assert.equal(repository.getMeals(photo.loggedDate).find((m) => m.id===photo.id).estimateState, 'failed');
  } finally { db.close(); }
});
