import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { open, repositoryFor } from './sqlite.mjs';
import { mealDraftInput } from '../src/lib/mealDraft.ts';

const input = { name: '2 roti dal chawal', portion: '1 katori', kcal: null, protein: null, fibre: null };
const estimate = { version: 1, model: 'test-fixture', kcal: 610, protein: 22, carbs: 90, fat: 16, fibre: 10, assumptions: ['Test fixture only; medium roti.'] };
const now = new Date('2026-10-05T06:00:00.000Z');

function withStore(fn) {
  const connection = open();
  try { fn(connection); }
  finally { connection.db.close(); }
}

function legacyDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE profile (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE meals (id TEXT PRIMARY KEY, name TEXT NOT NULL, portion TEXT NOT NULL, kcal REAL, protein REAL, fibre REAL,
      nutrition_status TEXT NOT NULL CHECK (nutrition_status IN ('pending', 'manual')),
      logged_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      CHECK ((nutrition_status = 'pending' AND kcal IS NULL AND protein IS NULL AND fibre IS NULL) OR
        (nutrition_status = 'manual' AND kcal IS NOT NULL AND protein IS NOT NULL AND fibre IS NOT NULL)));
    CREATE INDEX meals_by_day ON meals (logged_date, created_at);
    PRAGMA user_version = 1;
  `);
  return db;
}

test('version-one migration preserves legacy profile, IDs, dates and manual values; queues unknown meals once', () => {
  const db = legacyDatabase();
  const profile = { name: 'Legacy user' };
  db.prepare('INSERT INTO profile VALUES (1, ?)').run(JSON.stringify(profile));
  const insert = db.prepare('INSERT INTO meals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insert.run('legacy-manual', 'Dal', '1 katori', 200, 10, 5, 'manual', '2026-10-04', now.toISOString(), now.toISOString());
  insert.run('legacy-pending', 'Roti', '2 medium', null, null, null, 'pending', '2026-10-04', now.toISOString(), now.toISOString());
  const repository = repositoryFor(db);
  try {
    repository.initialize();
    repository.initialize();
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    assert.deepEqual(repository.getProfile(), profile);
    const [manual, pending] = repository.getMeals('2026-10-04');
    assert.equal(manual.id, 'legacy-manual');
    assert.equal(manual.kcal, 200);
    assert.equal(manual.carbs, null);
    assert.equal(manual.fat, null);
    assert.equal(manual.nutritionStatus, 'manual');
    assert.equal(manual.revision, 0);
    assert.equal(manual.createdAt, now.toISOString());
    assert.equal(pending.inputType, 'text');
    assert.equal(pending.estimateState, 'queued');
    assert.equal(repository.getNutritionJobs().length, 1);
  } finally { db.close(); }
});

test('nutrition migration rollback preserves legacy data and can be safely retried', () => {
  const db = legacyDatabase();
  const profile = { name: 'Migration fixture' };
  db.prepare('INSERT INTO profile VALUES (1, ?)').run(JSON.stringify(profile));
  let fail = true;
  const repository = repositoryFor(db, {
    execSync: (sql) => {
      if (fail && sql.includes('CREATE TABLE nutrition_jobs')) {
        fail = false;
        db.exec(sql.replace('CREATE TABLE nutrition_jobs (', 'CREATE TABLE nutrition_jobs invalid ('));
      } else db.exec(sql);
    },
  });
  try {
    assert.throws(() => repository.initialize());
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(db.prepare('PRAGMA table_info(meals)').all().some((column) => column.name === 'carbs'), false);
    assert.equal(db.prepare('SELECT data FROM profile').get().data, JSON.stringify(profile));
    repository.initialize();
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    assert.deepEqual(repository.getProfile(), profile);
  } finally { db.close(); }
});

test('migration does not reject or truncate a legacy description exceeding the new input limit', () => {
  const db = legacyDatabase();
  const name = 'Old meal '.repeat(100);
  db.prepare('INSERT INTO meals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('long-legacy', name, '1 plate', null, null, null, 'pending', '2026-10-05', now.toISOString(), now.toISOString());
  const repository = repositoryFor(db);
  try {
    repository.initialize();
    assert.equal(repository.getMeals('2026-10-05')[0].name, name);
    assert.equal(repository.getNutritionJobs().length, 1);
  } finally { db.close(); }
});

test('saved meal and pending job are atomic if queuing fails', () => withStore(({ db, repository }) => {
  db.exec("CREATE TRIGGER reject_job BEFORE INSERT ON nutrition_jobs BEGIN SELECT RAISE(ABORT, 'Queue write failed'); END;");
  assert.throws(() => repository.addMeal(input, now), /Queue write failed/);
  assert.deepEqual(repository.getMealDays(), []);
}));

test('jobs and full estimated macros survive database reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-nutrition-'));
  const path = join(dir, 'fitness.db');
  let connection = open(path);
  try {
    const meal = connection.repository.addMeal(input, now);
    connection.db.close();
    connection = open(path);
    const job = connection.repository.claimNutritionJob(now);
    assert.equal(job.mealId, meal.id);
    assert.equal(connection.repository.completeNutritionJob(job.id, job.leaseToken, estimate, now), true);
    connection.db.close();
    connection = open(path);
    const saved = connection.repository.getMeals(meal.loggedDate)[0];
    assert.equal(saved.nutritionStatus, 'estimated');
    assert.equal(saved.carbs, 90);
    assert.equal(saved.fat, 16);
    assert.deepEqual(saved.assumptions, estimate.assumptions);
    assert.equal(saved.estimateModel, 'test-fixture');
    assert.equal(connection.repository.getNutritionJobs()[0].state, 'completed');
  } finally { connection.db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('already queued duplicate meals consume a completed local cache entry without new provider work', () => withStore(({ repository }) => {
  const meals = [repository.addMeal(input, now), repository.addMeal(input, now), repository.addMeal(input, now)];
  const job = repository.claimNutritionJob(now);
  repository.completeNutritionJob(job.id, job.leaseToken, estimate, now);
  assert.equal(repository.claimNutritionJob(now), null);
  assert.equal(repository.getNutritionJobs().filter((queued) => queued.state === 'completed').length, 3);
  for (const meal of meals) assert.equal(repository.getMeals(meal.loggedDate).find((saved) => saved.id === meal.id).kcal, 610);
}));

test('normalized repeated text reuses estimates, but different quantities do not', () => withStore(({ repository }) => {
  repository.addMeal(input, now);
  const job = repository.claimNutritionJob(now);
  repository.completeNutritionJob(job.id, job.leaseToken, estimate, now);
  const repeated = repository.addMeal({ ...input, name: '  2 ROTI  dal chawal  ', portion: '1  KATORI' }, now);
  assert.equal(repeated.nutritionStatus, 'estimated');
  assert.equal(repository.getNutritionJobs().length, 1);
  const different = repository.addMeal({ ...input, name: '1 roti dal chawal' }, now);
  assert.equal(different.nutritionStatus, 'pending');
  assert.equal(repository.getNutritionJobs().length, 2);
}));

test('portion correction cancels old job and rejects its late response', () => withStore(({ repository }) => {
  const meal = repository.addMeal(input, now);
  const job = repository.claimNutritionJob(now);
  const updated = repository.updateMeal(meal.id, { ...input, portion: '2 katori' }, now);
  assert.equal(updated.revision, 1);
  assert.equal(repository.completeNutritionJob(job.id, job.leaseToken, estimate, now), false);
  assert.equal(repository.getMeals(meal.loggedDate)[0].kcal, null);
  assert.equal(repository.getNutritionJobs()[0].state, 'cancelled');
}));

test('manual corrections win over in-flight estimates and do not populate generic cache', () => withStore(({ repository }) => {
  const meal = repository.addMeal(input, now);
  const job = repository.claimNutritionJob(now);
  const updated = repository.updateMeal(meal.id, { ...input, kcal: 400, protein: 20, fibre: 8, carbs: 50, fat: 10 }, now);
  assert.equal(updated.nutritionStatus, 'manual');
  assert.equal(repository.completeNutritionJob(job.id, job.leaseToken, estimate, now), false);
  assert.equal(repository.getMeals(meal.loggedDate)[0].kcal, 400);
  const repeated = repository.addMeal(input, now);
  assert.equal(repeated.kcal, null);
}));

test('editing estimated food requeues it without treating old model values as manual', () => withStore(({ repository }) => {
  const meal = repository.addMeal(input, now);
  const job = repository.claimNutritionJob(now);
  repository.completeNutritionJob(job.id, job.leaseToken, estimate, now);
  const updated = repository.updateMeal(meal.id, { ...input, name: '3 roti dal chawal' }, now);
  assert.equal(updated.nutritionStatus, 'pending');
  assert.equal(updated.kcal, null);
  assert.equal(updated.revision, 1);
  assert.equal(updated.loggedDate, meal.loggedDate);
  assert.equal(updated.createdAt, meal.createdAt);
}));

test('actual editor draft path does not silently convert unchanged AI numbers into manual overrides', () => withStore(({ repository }) => {
  const meal = repository.addMeal(input, now);
  const job = repository.claimNutritionJob(now);
  repository.completeNutritionJob(job.id, job.leaseToken, estimate, now);
  const saved = repository.getMeals(meal.loggedDate)[0];
  const draft = { name: '3 roti dal chawal', portion: input.portion, kcal: '610', protein: '22', carbs: '90', fat: '16', fibre: '10' };
  const edited = repository.updateMeal(saved.id, mealDraftInput(saved, draft), now);
  assert.equal(edited.kcal, null);
  assert.equal(edited.nutritionStatus, 'pending');
  const corrected = repository.updateMeal(saved.id, mealDraftInput(saved, { ...draft, kcal: '500' }), now);
  assert.equal(corrected.kcal, 500);
  assert.equal(corrected.nutritionStatus, 'manual');
}));

test('expired lease recovers the same job and ignores the earlier worker response', () => withStore(({ repository }) => {
  repository.addMeal(input, now);
  const first = repository.claimNutritionJob(now);
  assert.equal(repository.claimNutritionJob(now), null);
  const later = new Date(now.getTime() + 6 * 60 * 1000);
  const second = repository.claimNutritionJob(later);
  assert.equal(first.id, second.id);
  assert.notEqual(first.leaseToken, second.leaseToken);
  assert.equal(second.attempts, 2);
  assert.equal(repository.completeNutritionJob(first.id, first.leaseToken, estimate, later), false);
  assert.equal(repository.completeNutritionJob(second.id, second.leaseToken, estimate, later), true);
}));

test('transient retries are bounded and manual retry retains idempotent job identity', () => withStore(({ repository }) => {
  const meal = repository.addMeal(input, now);
  const job = repository.claimNutritionJob(now);
  assert.equal(repository.failNutritionJob(job.id, job.leaseToken, 'network', now), true);
  assert.equal(repository.getMeals(meal.loggedDate)[0].estimateState, 'queued');
  assert.equal(repository.claimNutritionJob(now), null);
  for (const offset of [31000,92000]) {
    const date = new Date(now.getTime()+offset);
    const retry = repository.claimNutritionJob(date);
    repository.failNutritionJob(retry.id,retry.leaseToken,'network',date);
  }
  assert.equal(repository.getMeals(meal.loggedDate)[0].estimateState,'failed');
  const later = new Date(now.getTime()+3600000);
  assert.equal(repository.claimNutritionJob(later),null);
  repository.retryNutritionJob(meal.id,later);
  const retry = repository.claimNutritionJob(later);
  assert.equal(retry.id, job.id);
  assert.equal(repository.getNutritionJobs().length, 1);
}));

test('photos require a local file and do not reuse a text cache from the same caption', () => withStore(({ repository }) => {
  repository.addMeal(input, now);
  const job = repository.claimNutritionJob(now);
  repository.completeNutritionJob(job.id, job.leaseToken, estimate, now);
  assert.throws(() => repository.addMeal({ ...input, inputType: 'photo' }, now), /photo/i);
  assert.throws(() => repository.addMeal({ ...input, inputType: 'photo', photoUri: 'https://example.com/private.jpg' }, now), /local/i);
  const meal = repository.addMeal({ ...input, inputType: 'photo', photoUri: 'file:///documents/test-fixture.jpg' }, now);
  assert.equal(meal.photoUri, 'file:///documents/test-fixture.jpg');
  assert.equal(meal.nutritionStatus, 'pending');
  const photoJob = repository.claimNutritionJob(now);
  assert.equal(photoJob.input.inputType, 'photo');
  assert.equal(photoJob.cacheKey, null);
}));

test('invalid estimate cannot complete a job, corrupt totals or enter cache', () => withStore(({ repository }) => {
  const meal = repository.addMeal(input, now);
  const job = repository.claimNutritionJob(now);
  for (const bad of [
    { ...estimate, kcal: NaN }, { ...estimate, protein: -1 }, { ...estimate, fat: Infinity },
    { ...estimate, carbs: 1000000 }, { ...estimate, version: 99 }, { ...estimate, assumptions: [42] },
  ]) assert.throws(() => repository.completeNutritionJob(job.id, job.leaseToken, bad, now));
  assert.equal(repository.getMeals(meal.loggedDate)[0].kcal, null);
  assert.equal(repository.getNutritionJobs()[0].state, 'running');
}));
