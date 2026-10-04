import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { localDateKey, validateMealInput, sumNutrition } from '../src/lib/meals.ts';
import { LoggingRepository } from '../src/lib/loggingRepository.ts';

function repositoryFor(db, overrides = {}) {
  return new LoggingRepository({
    execSync: (sql) => db.exec(sql),
    runSync: (sql, ...params) => db.prepare(sql).run(...params),
    getFirstSync: (sql, ...params) => db.prepare(sql).get(...params) ?? null,
    getAllSync: (sql, ...params) => db.prepare(sql).all(...params),
    withTransactionSync: (task) => {
      db.exec('BEGIN');
      try { task(); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    ...overrides,
  });
}

function open(path = ':memory:') {
  const db = new DatabaseSync(path);
  const repository = repositoryFor(db);
  repository.initialize();
  return { db, repository };
}

const profile = { name: 'Shailendra', sex: 'male', age: 28, heightCm: 172, weightKg: 70, goal: 'maintain', diet: 'veg' };
const input = { name: '2 roti dal chawal', portion: '1 katori dal', kcal: null, protein: null, fibre: null };

test('new database has no fabricated profile or meals; initialization is idempotent', () => {
  const { db, repository } = open();
  try {
    repository.initialize();
    assert.equal(repository.getProfile(), null);
    assert.deepEqual(repository.getMeals('2026-10-05'), []);
  } finally { db.close(); }
});

test('profile and offline meal survive database close and reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-logging-'));
  const path = join(dir, 'fitness.db');
  let connection = open(path);
  try {
    connection.repository.saveProfile(profile);
    const saved = connection.repository.addMeal(input, new Date('2026-10-05T09:30:00+05:30'));
    assert.equal(saved.nutritionStatus, 'pending');
    assert.equal(saved.kcal, null);
    connection.db.close();
    connection = open(path);
    assert.deepEqual(connection.repository.getProfile(), profile);
    assert.deepEqual(connection.repository.getMeals(saved.loggedDate), [saved]);
  } finally {
    connection.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('manual correction survives reopen and keeps identity and original day', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitness-correction-'));
  const path = join(dir, 'fitness.db');
  let connection = open(path);
  try {
    const saved = connection.repository.addMeal(input, new Date(2026, 9, 5, 23, 59));
    const updated = connection.repository.updateMeal(saved.id, { ...input, kcal: 610, protein: 22, fibre: 10 }, new Date(2026, 9, 6, 0, 1));
    assert.equal(updated.id, saved.id);
    assert.equal(updated.createdAt, saved.createdAt);
    assert.equal(updated.loggedDate, '2026-10-05');
    assert.equal(updated.time, '23:59');
    assert.equal(updated.nutritionStatus, 'manual');
    connection.db.close();
    connection = open(path);
    assert.deepEqual(connection.repository.getMeals('2026-10-05'), [updated]);
    assert.deepEqual(connection.repository.getMeals('2026-10-06'), []);
  } finally {
    connection.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('logs stay isolated by local date and repeated meals get unique IDs', () => {
  const { db, repository } = open();
  try {
    const first = repository.addMeal(input, new Date(2026, 9, 5, 23, 59));
    const second = repository.addMeal(input, new Date(2026, 9, 6, 0, 1));
    assert.notEqual(first.id, second.id);
    assert.deepEqual(repository.getMeals('2026-10-05'), [first]);
    assert.deepEqual(repository.getMeals('2026-10-06'), [second]);
    assert.equal(localDateKey(new Date(2026, 0, 2, 0, 1)), '2026-01-02');
  } finally { db.close(); }
});

test('unknown nutrition is excluded from totals, explicit zero remains a manual value', () => {
  const { db, repository } = open();
  try {
    const pending = repository.addMeal(input);
    const manual = repository.addMeal({ ...input, kcal: 100, protein: 0, fibre: 2 });
    assert.equal(manual.nutritionStatus, 'manual');
    assert.deepEqual(sumNutrition([pending, manual]), { kcal: 100, protein: 0, fibre: 2, pending: 1 });
  } finally { db.close(); }
});

test('blank names and incomplete/invalid nutrition fail before database writes', () => {
  const { db, repository } = open();
  try {
    for (const invalid of [
      { ...input, name: ' ' },
      { ...input, kcal: 100 },
      { ...input, kcal: -1, protein: 0, fibre: 0 },
      { ...input, kcal: NaN, protein: 0, fibre: 0 },
      { ...input, kcal: Infinity, protein: 0, fibre: 0 },
    ]) {
      assert.throws(() => validateMealInput(invalid));
      assert.throws(() => repository.addMeal(invalid));
    }
    assert.deepEqual(repository.getMeals(localDateKey(new Date())), []);
    assert.throws(() => repository.updateMeal('missing', input), /not found/);
  } finally { db.close(); }
});

test('bound parameters preserve punctuation and SQL-like meal descriptions', () => {
  const { db, repository } = open();
  try {
    const saved = repository.addMeal({ ...input, name: "Rajma'); DROP TABLE meals; --" });
    assert.equal(repository.getMeals(saved.loggedDate)[0].name, saved.name);
    assert.equal(repository.getMeals(saved.loggedDate).length, 1);
  } finally { db.close(); }
});

test('failed schema initialization rolls back and can be retried safely', () => {
  const db = new DatabaseSync(':memory:');
  let fail = true;
  const repository = repositoryFor(db, {
    execSync: (sql) => {
      if (fail && sql.includes('CREATE TABLE meals')) {
        fail = false;
        db.exec(sql.replace('CREATE TABLE meals (', 'CREATE TABLE meals invalid ('));
      } else db.exec(sql);
    },
  });
  try {
    assert.throws(() => repository.initialize());
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 0);
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(), []);
    repository.initialize();
    assert.equal(repository.getProfile(), null);
  } finally { db.close(); }
});

test('failed writes report errors and preserve the previous saved record', () => {
  const { db, repository } = open();
  try {
    const saved = repository.addMeal(input);
    repository.saveProfile(profile);
    db.exec('PRAGMA query_only = ON');
    assert.throws(() => repository.addMeal(input));
    assert.throws(() => repository.updateMeal(saved.id, { ...input, name: 'Changed meal' }));
    assert.throws(() => repository.saveProfile({ ...profile, name: 'Changed name' }));
    assert.deepEqual(repository.getMeals(saved.loggedDate), [saved]);
    assert.deepEqual(repository.getProfile(), profile);
  } finally { db.close(); }
});

test('history returns unique logged days newest first, including older corrected meals', () => {
  const { db, repository } = open();
  try {
    assert.deepEqual(repository.getMealDays(), []);
    const older = repository.addMeal(input, new Date(2026, 8, 30, 23, 59));
    const today = repository.addMeal(input, new Date(2026, 9, 5, 12));
    repository.addMeal(input, new Date(2026, 9, 5, 13));
    repository.updateMeal(older.id, { ...input, name: 'Corrected old meal' }, new Date(2026, 9, 5, 14));
    assert.deepEqual(repository.getMealDays(), ['2026-10-05', '2026-09-30']);
    assert.equal(repository.getMeals('2026-09-30')[0].name, 'Corrected old meal');
    assert.equal(repository.getMeals('2026-10-05')[0].id, today.id);
  } finally { db.close(); }
});

test('export snapshot includes profile and every saved day, preserving corrections and unknown nutrition', () => {
  const { db, repository } = open();
  try {
    assert.deepEqual(repository.getExportData(), { profile: null, meals: [] });
    repository.saveProfile(profile);
    const today = repository.addMeal(input, new Date(2026, 9, 5, 12));
    const yesterday = repository.addMeal(input, new Date(2026, 9, 4, 12));
    const updated = repository.updateMeal(yesterday.id, { ...input, kcal: 450, protein: 10, fibre: 5 });
    assert.deepEqual(repository.getExportData(), { profile, meals: [updated, today] });
    assert.deepEqual(repository.getMeals(today.loggedDate), [today]);
    assert.deepEqual(repository.getMeals(yesterday.loggedDate), [updated]);
  } finally { db.close(); }
});

test('a newer database schema is rejected rather than overwritten', () => {
  const { db, repository } = open();
  try {
    db.exec('PRAGMA user_version = 999');
    assert.throws(() => repository.initialize(), /newer/);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 999);
  } finally { db.close(); }
});
