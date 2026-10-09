import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { open, repositoryFor } from './sqlite.mjs';
import { processVoiceJobs, VoiceTransportError } from '../src/lib/voiceWorker.ts';
import { makeExportDocument } from '../src/lib/exportData.ts';
import { validateVoiceBytes, validateTranscript, validateRecordingUri } from '../src/lib/voice.ts';

const uri = 'file:///documents/Audio/recording-fixture.m4a';
const now = new Date(2026, 9, 10, 23, 59);

import { audioFixture } from './voiceFixture.mjs';

test('voice records and queued work survive reopen; interrupted capture is explicit', () => {
  const folder = mkdtempSync(join(tmpdir(), 'fitness-voice-'));
  let connection = open(join(folder, 'logging.db'));
  try {
    const queued = connection.repository.startVoiceRecording(uri, now);
    connection.repository.queueVoiceRecording(queued.id, 2000, now);
    const interrupted = connection.repository.startVoiceRecording(uri, now);
    connection.db.close(); connection = open(join(folder, 'logging.db'));
    assert.equal(connection.repository.getVoiceJob(queued.id).state, 'queued');
    assert.equal(connection.repository.getVoiceJob(queued.id).audioUri, uri);
    assert.equal(connection.repository.getVoiceJob(interrupted.id).errorCode, 'interrupted');
    assert.deepEqual(connection.repository.getMeals('2026-10-10'), []);
  } finally { connection.db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('transcript review produces one correctable text draft through the existing cached nutrition pipeline', () => {
  const { db, repository } = open();
  try {
    const recording = repository.startVoiceRecording(uri, now);
    repository.queueVoiceRecording(recording.id, 2000, now);
    const job = repository.claimVoiceJob(now);
    assert.equal(repository.completeVoiceJob(job.id, job.leaseToken, 'दो रोटी और दाल', now), true);
    assert.equal(repository.getVoiceJob(job.id).state, 'ready');
    const draft = repository.reviewVoiceTranscript(job.id, '2 roti and dal', now);
    assert.equal(draft.inputType, 'text');
    assert.equal(draft.logState, 'draft');
    assert.equal(draft.name, '2 roti and dal');
    assert.equal(draft.loggedDate, '2026-10-10');
    assert.equal(repository.getNutritionJobs().length, 1);
    assert.equal(repository.reviewVoiceTranscript(job.id, 'duplicate', now).id, draft.id);
    assert.equal(repository.getNutritionJobs().length, 1);
    assert.deepEqual(repository.getMeals(draft.loggedDate), []);
    repository.savePhotoDraft(draft.id, now);
    assert.equal(repository.getMeals(draft.loggedDate).length, 1);
    assert.equal(repository.getExportData().voice[0].transcript, 'दो रोटी और दाल');
  } finally { db.close(); }
});

test('discard or a typed correction wins over a late transcription', () => {
  const { db, repository } = open();
  try {
    const recording = repository.startVoiceRecording(uri, now);
    repository.queueVoiceRecording(recording.id, 2000, now);
    const job = repository.claimVoiceJob(now);
    const typed = repository.reviewVoiceTranscript(job.id, 'My corrected meal', now);
    assert.equal(repository.completeVoiceJob(job.id, job.leaseToken, 'Wrong late words', now), false);
    assert.equal(repository.getMeal(typed.id).name, 'My corrected meal');
    const another = repository.startVoiceRecording(uri, now);
    repository.queueVoiceRecording(another.id, 2000, now);
    const pending = repository.claimVoiceJob(now);
    repository.discardVoiceJob(another.id, now);
    assert.equal(repository.completeVoiceJob(pending.id, pending.leaseToken, 'Late', now), false);
    assert.throws(() => repository.reviewVoiceTranscript(another.id, 'New words', now), /discarded/);
  } finally { db.close(); }
});

test('voice retries are bounded, lease-protected and reuse the same ID', () => {
  const { db, repository } = open();
  try {
    const recording = repository.startVoiceRecording(uri, now);
    repository.queueVoiceRecording(recording.id, 2000, now);
    let date = now;
    for (let i = 0; i < 3; i++) {
      const job = repository.claimVoiceJob(date);
      assert.equal(job.id, recording.id);
      repository.failVoiceJob(job.id, job.leaseToken, 'network', date);
      date = new Date(date.getTime() + 120000);
    }
    assert.equal(repository.claimVoiceJob(date), null);
    assert.equal(repository.getVoiceJob(recording.id).state, 'failed');
    repository.retryVoiceJob(recording.id, date);
    assert.equal(repository.claimVoiceJob(date).id, recording.id);
  } finally { db.close(); }
});

test('voice worker defers pending responses, fails soft offline and never writes fake nutrition', async () => {
  const { db, repository } = open();
  try {
    const recording = repository.startVoiceRecording(uri, now);
    repository.queueVoiceRecording(recording.id, 2000, now);
    await processVoiceJobs(repository, async () => ({ state: 'pending' }), () => {}, () => true, () => now);
    assert.equal(repository.getVoiceJob(recording.id).state, 'queued');
    const later = new Date(now.getTime() + 6000);
    await processVoiceJobs(repository, async () => { throw new VoiceTransportError('network'); }, () => {}, () => true, () => later);
    assert.equal(repository.getVoiceJob(recording.id).errorCode, 'network');
    const retry = new Date(later.getTime() + 120000);
    await processVoiceJobs(repository, async () => ({ state: 'ready', transcript: '' }), () => {}, () => true, () => retry);
    assert.equal(repository.getVoiceJob(recording.id).state, 'failed');
    assert.equal(repository.getVoiceJob(recording.id).errorCode, 'invalid_result');
    assert.deepEqual(repository.getMeals('2026-10-10'), []);
    const exported = JSON.parse(makeExportDocument(repository.getExportData()));
    assert.equal(exported.voice[0].id, recording.id);
    assert.equal(exported.voice[0].audioUri, uri);
  } finally { db.close(); }
});

test('voice review is atomic and transcript/lease state survives failed writes and stale workers', () => {
  const { db, repository } = open();
  try {
    const recording = repository.startVoiceRecording(uri, now);
    repository.queueVoiceRecording(recording.id, 2000, now);
    const old = repository.claimVoiceJob(now);
    const later = new Date(now.getTime() + 121000);
    const current = repository.claimVoiceJob(later);
    assert.equal(repository.completeVoiceJob(old.id, old.leaseToken, 'stale text', later), false);
    assert.equal(repository.completeVoiceJob(current.id, current.leaseToken, 'dal rice', later), true);
    const failing = repositoryFor(db, { runSync: (sql, ...params) => {
      if (sql.includes('INSERT INTO nutrition_jobs')) throw new Error('Disk full');
      return db.prepare(sql).run(...params);
    } });
    assert.throws(() => failing.reviewVoiceTranscript(recording.id, 'dal rice', later), /Disk full/);
    assert.equal(repository.getVoiceJob(recording.id).mealId, null);
    assert.deepEqual(repository.getPhotoDrafts(), []);
    assert.equal(repository.getVoiceCleanup()[0].audioUri, uri);
    repository.clearVoiceAudio(recording.id);
    assert.equal(repository.getVoiceJob(recording.id).audioUri, null);
    assert.equal(repository.reviewVoiceTranscript(recording.id, 'dal rice', later).name, 'dal rice');
  } finally { db.close(); }
});

test('voice migration can be rolled back and retried without touching old meals', () => {
  const { db, repository } = open();
  try {
    const saved = repository.addMeal({ name: 'Old meal', portion: '', kcal: null, protein: null, fibre: null }, now);
    db.exec('PRAGMA user_version = 3;');
    let fail = true;
    const migration = repositoryFor(db, { execSync: (sql) => {
      db.exec(sql);
      if (fail && sql.includes('CREATE TABLE IF NOT EXISTS voice_jobs')) { fail = false; throw new Error('Interrupted migration'); }
    } });
    assert.throws(() => migration.initialize(), /Interrupted/);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    migration.initialize();
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 4);
    assert.equal(repository.getMeal(saved.id).name, 'Old meal');
  } finally { db.close(); }
});

test('voice boundaries reject empty/overlong text, unowned paths, oversized/incomplete and long audio', () => {
  assert.equal(validateTranscript('  paneer roti  '), 'paneer roti');
  for (const value of ['', ' ', null, 'a'.repeat(501)]) assert.throws(() => validateTranscript(value));
  validateRecordingUri(uri, 'file:///documents');
  for (const path of ['file:///documents/../private.m4a', 'file:///documents/%2e%2e/a.m4a', 'https://example.com/a.m4a']) assert.throws(() => validateRecordingUri(path, 'file:///documents'));
  assert.equal(validateVoiceBytes(audioFixture()), 2);
  for (const bytes of [new Uint8Array(1000001), audioFixture(100), audioFixture(0), audioFixture().slice(0, 30)]) assert.throws(() => validateVoiceBytes(bytes));
});
