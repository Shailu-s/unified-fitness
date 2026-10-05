import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNutritionHandler } from '../../supabase/functions/_shared/handler.ts';
import { photoObjectPath, verifiedPhoto } from '../../supabase/functions/_shared/photo.ts';
import { createOpenAIEstimator, OPENAI_NUTRITION_MODEL } from '../../supabase/functions/_shared/model.ts';

const owner = '00000000-0000-4000-8000-000000000001';
const input = { clientId: 'a'.repeat(32), inputType: 'photo', name: 'Photo meal', portion: 'Portion not specified', photoSha256: 'b'.repeat(64) };
const result = { version: 1, model: 'test-fixture', kcal: 500, protein: 20, carbs: 60, fat: 20, fibre: 5,
  assumptions: ['Hidden oil is unknown.'], foods: [{ name: 'Paneer', portion: '1 bowl' }] };
function setup(overrides = {}) {
  const events = [];
  const handler = createNutritionHandler({ model: 'test-fixture', authenticate: async () => owner,
    claim: async (uid, body, key) => { events.push({ uid, key }); return { state: 'claimed', leaseToken: 'lease' }; },
    loadPhoto: async (uid, id, digest) => { events.push({ uid, id, digest }); return { mimeType: 'image/jpeg', base64: 'AAEC' }; },
    estimate: async (_body, image) => { assert.ok(image); events.push('model'); return result; },
    finish: async () => true, fail: async () => {}, removePhoto: async (uid,id) => { events.push({ removed: `${uid}/${id}` }); },
    ...overrides });
  const request = (body = input) => handler(new Request('http://localhost/nutrition', { method: 'POST', headers: { authorization: 'Bearer test' }, body: JSON.stringify(body) }));
  return { request, events };
}

test('photo endpoint derives owner/path, passes image, persists identified foods and cleans upload', async () => {
  const { request, events } = setup();
  const response = await request();
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).estimate,result);
  assert.equal(events[0].uid,owner);
  assert.equal(events[1].id,input.clientId);
  assert.deepEqual(events.at(-1),{removed:`${owner}/${input.clientId}`});
});

test('photo caption cannot reuse text cache, and owner/image identity changes cache namespace', async () => {
  const a = setup(), b = setup(), c = setup();
  await a.request(); await b.request({ ...input, photoSha256:'c'.repeat(64) }); await c.request({ ...input, clientId:'d'.repeat(32) });
  assert.notEqual(a.events[0].key,b.events[0].key);
  assert.notEqual(a.events[0].key,c.events[0].key);
  const other = setup({ authenticate: async () => '00000000-0000-4000-8000-000000000002' });
  await other.request();
  assert.notEqual(a.events[0].key,other.events[0].key);
});

test('cached photo retry needs no image fetch or model call and cleans a re-upload', async () => {
  const { request, events } = setup({ claim: async () => ({state:'ready',estimate:result}) });
  assert.equal((await request()).status,200);
  assert.deepEqual(events,[{removed:`${owner}/${input.clientId}`}]);
});

test('non-food returns explicit failure, never zero calories, and cleans photo', async () => {
  const { request, events } = setup({ estimate: async () => { throw new Error('not_food'); } });
  const response = await request();
  assert.equal(response.status,422);
  assert.deepEqual(await response.json(),{error:'not_food'});
  assert.deepEqual(events.at(-1),{removed:`${owner}/${input.clientId}`});
});

test('unowned paths/digests/oversized or malformed JPEG cannot reach inference', async () => {
  assert.throws(()=>photoObjectPath('../owner',input.clientId));
  assert.equal(photoObjectPath(owner,input.clientId),`${owner}/${input.clientId}.jpg`);
  const bytes = Uint8Array.from([255,216,255,218,0,2,1,255,217]);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),(byte)=>byte.toString(16).padStart(2,'0')).join('');
  assert.equal((await verifiedPhoto(new Blob([bytes],{type:'image/jpeg'}),hash)).mimeType,'image/jpeg');
  await assert.rejects(verifiedPhoto(new Blob([bytes],{type:'image/jpeg'}),'0'.repeat(64)),/digest/);
  await assert.rejects(verifiedPhoto(new Blob([new Uint8Array(2100001)],{type:'image/jpeg'}),hash));
  await assert.rejects(verifiedPhoto(new Blob(['<svg/>'],{type:'image/svg+xml'}),hash));
});

test('vision schema rejects non-food and incomplete recognition instead of fabricating a meal', async () => {
  const model = (payload) => createOpenAIEstimator('fake',OPENAI_NUTRITION_MODEL,async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(payload)}]}]}));
  await assert.rejects(model({is_food:false,foods:[],kcal:null,protein:null,carbs:null,fat:null,fibre:null,assumptions:[]})(input,{mimeType:'image/jpeg',base64:'AAEC'}),/not_food/);
  await assert.rejects(model({...result,is_food:true,foods:[]})(input,{mimeType:'image/jpeg',base64:'AAEC'}),/recognition/);
});
