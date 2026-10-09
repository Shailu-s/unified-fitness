import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { open, repositoryFor } from './sqlite.mjs';
import { sumNutrition } from '../src/lib/meals.ts';
import { makeExportDocument } from '../src/lib/exportData.ts';
import { mealDraftInput } from '../src/lib/mealDraft.ts';

const input = { name: '', portion: '', kcal: null, protein: null, fibre: null, inputType: 'photo', photoUri: 'file:///documents/meal-photos/fixture.jpg' };
const now = new Date(2026, 9, 10, 23, 59);
const estimate = { version: 1, model: 'test-fixture', kcal: 500, protein: 20, carbs: 60, fat: 20, fibre: 5, assumptions: ['Oil amount unknown.'], foods: [{ name: 'Paneer and roti', portion: '2 roti, 1 bowl' }] };

function complete(repository, date = now) {
  const job = repository.claimNutritionJob(date, ['photo']);
  assert.ok(job);
  assert.equal(repository.completeNutritionJob(job.id, job.leaseToken, estimate, date), true);
  return job;
}

test('photo drafts are durable and estimated without entering daily totals or history', () => {
  const folder = mkdtempSync(join(tmpdir(), 'fitness-draft-'));
  let connection = open(join(folder, 'logging.db'));
  try {
    const draft = connection.repository.addPhotoDraft(input, now);
    assert.equal(draft.logState, 'draft');
    complete(connection.repository);
    connection.db.close();
    connection = open(join(folder, 'logging.db'));
    const reviewed = connection.repository.getPhotoDrafts()[0];
    assert.equal(reviewed.id, draft.id);
    assert.equal(reviewed.photoUri, input.photoUri);
    assert.equal(reviewed.name, 'Paneer and roti');
    assert.equal(reviewed.kcal, 500);
    assert.deepEqual(connection.repository.getMeals(draft.loggedDate), []);
    assert.deepEqual(connection.repository.getMealDays(), []);
    assert.equal(sumNutrition([reviewed]).kcal, 0);
    const exported = JSON.parse(makeExportDocument(connection.repository.getExportData()));
    assert.deepEqual(exported.meals, []);
    assert.equal(exported.drafts[0].id, draft.id);
  } finally { connection.db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('Save meal promotes the same estimated draft exactly once and preserves capture date', () => {
  const { db, repository } = open();
  try {
    const draft = repository.addPhotoDraft(input, now);
    complete(repository);
    const saved = repository.savePhotoDraft(draft.id, new Date(2026, 9, 11, 0, 1));
    assert.equal(saved.logState, 'saved');
    assert.equal(saved.loggedDate, '2026-10-10');
    assert.equal(saved.nutritionStatus, 'estimated');
    assert.deepEqual(saved.foods, estimate.foods);
    assert.deepEqual(repository.getPhotoDrafts(), []);
    repository.savePhotoDraft(draft.id);
    assert.equal(repository.getMeals(saved.loggedDate).length, 1);
    assert.equal(sumNutrition(repository.getMeals(saved.loggedDate)).kcal, 500);
    assert.equal(repository.getNutritionJobs().length, 1);
  } finally { db.close(); }
});

test('opening and accepting unchanged photo details does not queue another paid estimate', () => {
  const { db, repository } = open();
  try {
    const draft = repository.addPhotoDraft(input, now);
    complete(repository);
    const reviewed = repository.getMeal(draft.id);
    const fields = Object.fromEntries(['name', 'portion', 'kcal', 'protein', 'carbs', 'fat', 'fibre'].map((key) => [key, String(reviewed[key])]));
    const unchanged = repository.updateMeal(draft.id, mealDraftInput(reviewed, fields), now);
    assert.deepEqual(unchanged, reviewed);
    assert.equal(repository.getNutritionJobs().length, 1);
    assert.equal(repository.claimNutritionJob(now), null);
  } finally { db.close(); }
});

test('pending drafts can be saved offline and receive their estimate later', () => {
  const { db, repository } = open();
  try {
    const draft = repository.addPhotoDraft(input, now);
    const saved = repository.savePhotoDraft(draft.id, now);
    assert.equal(saved.nutritionStatus, 'pending');
    assert.equal(saved.kcal, null);
    complete(repository);
    assert.equal(repository.getMeals(saved.loggedDate)[0].kcal, 500);
  } finally { db.close(); }
});

test('corrections stay drafts until Save and late estimates cannot overwrite them', () => {
  const { db, repository } = open();
  try {
    const draft = repository.addPhotoDraft(input, now);
    const job = repository.claimNutritionJob(now);
    const corrected = repository.updateMeal(draft.id, { ...input, name: 'My paneer', kcal: 450, protein: 18, carbs: 55, fat: 17, fibre: 4 }, now);
    assert.equal(corrected.logState, 'draft');
    assert.equal(repository.completeNutritionJob(job.id, job.leaseToken, estimate, now), false);
    assert.equal(repository.getMeals(corrected.loggedDate).length, 0);
    assert.equal(repository.savePhotoDraft(draft.id, now).kcal, 450);
  } finally { db.close(); }
});

test('discard cancels outstanding work and cannot discard already saved meals', () => {
  const { db, repository } = open();
  try {
    const draft = repository.addPhotoDraft(input, now);
    const job = repository.claimNutritionJob(now);
    repository.discardPhotoDraft(draft.id, now);
    assert.equal(repository.completeNutritionJob(job.id, job.leaseToken, estimate, now), false);
    assert.equal(repository.claimNutritionJob(now), null);
    assert.deepEqual(repository.getPhotoDrafts(), []);
    assert.equal(repository.getMeal(draft.id).photoUri, null);
    assert.throws(() => repository.savePhotoDraft(draft.id), /discarded/);
    assert.throws(() => repository.updateMeal(draft.id, input), /discarded/);
    const saved = repository.addMeal(input, now);
    assert.throws(() => repository.discardPhotoDraft(saved.id), /draft/);
    assert.equal(repository.getMeals(saved.loggedDate).length, 1);
  } finally { db.close(); }
});

test('failed Save keeps a draft intact for retry without adding to daily totals', () => {
  const { db, repository } = open();
  try {
    const draft = repository.addPhotoDraft(input, now);
    complete(repository);
    db.exec('PRAGMA query_only = ON');
    assert.throws(() => repository.savePhotoDraft(draft.id, now));
    assert.equal(repository.getPhotoDrafts()[0].kcal, 500);
    assert.deepEqual(repository.getMeals(draft.loggedDate), []);
    db.exec('PRAGMA query_only = OFF');
    repository.savePhotoDraft(draft.id, now);
    assert.equal(repository.getMeals(draft.loggedDate).length, 1);
  } finally { db.close(); }
});

test('v3 migration failure rolls back safely and can be retried without losing v2 data', () => {
  const { db, repository } = open();
  try {
    const saved = repository.addMeal(input, now);
    db.exec('ALTER TABLE meals DROP COLUMN log_state; PRAGMA user_version = 2;');
    let fail = true;
    const upgraded = repositoryFor(db, { execSync: (sql) => {
      db.exec(sql);
      if (fail && sql.includes('ADD COLUMN log_state')) { fail = false; throw new Error('Interrupted migration'); }
    } });
    assert.throws(() => upgraded.initialize(), /Interrupted/);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(db.prepare('PRAGMA table_info(meals)').all().some((column) => column.name === 'log_state'), false);
    upgraded.initialize();
    assert.equal(upgraded.getMeal(saved.id).photoUri, input.photoUri);
    assert.equal(upgraded.getMeal(saved.id).logState, 'saved');
    assert.equal(upgraded.getNutritionJobs().length, 1);
  } finally { db.close(); }
});

test('v2 upgrade preserves logged meals and failed draft writes leave no partial record', () => {
  const { db, repository } = open();
  try {
    const saved = repository.addMeal({ ...input, inputType: 'text', photoUri: null, name: 'Dal and rice' }, now);
    db.exec('ALTER TABLE meals DROP COLUMN log_state; PRAGMA user_version = 2;');
    repository.initialize();
    repository.initialize();
    assert.equal(repository.getMeal(saved.id).logState, 'saved');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    const failing = repositoryFor(db, { runSync: (sql, ...params) => {
      if (sql.includes('INSERT INTO nutrition_jobs')) throw new Error('Disk full');
      return db.prepare(sql).run(...params);
    } });
    assert.throws(() => failing.addPhotoDraft(input, now), /Disk full/);
    assert.equal(repository.getPhotoDrafts().length, 0);
    db.exec('PRAGMA query_only = ON');
    assert.throws(() => repository.addPhotoDraft(input, now));
    assert.equal(repository.getMeals(saved.loggedDate).length, 1);
  } finally { db.close(); }
});
