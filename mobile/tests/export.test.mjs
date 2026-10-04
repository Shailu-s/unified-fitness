import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shiftLocalDay } from '../src/lib/meals.ts';
import { makeExportDocument, shareLocalExport } from '../src/lib/exportData.ts';

const now = new Date('2026-10-05T12:34:56.789Z');
const meal = {
  id: 'stable-id', name: 'दाल, roti "medium"\nwith rice', portion: '1 katori', emoji: '', time: '12:00',
  kcal: null, protein: null, fibre: null, nutritionStatus: 'pending', loggedDate: '2026-10-04',
  createdAt: '2026-10-04T06:30:00.000Z', updatedAt: '2026-10-05T06:30:00.000Z',
};
const data = { profile: { name: 'Test user', diet: 'veg' }, meals: [meal] };

function platform(events, overrides = {}) {
  return {
    isAvailable: async () => true,
    writeFile: async (name, content) => { events.push({ name, content }); return 'file:///private/test-export.json'; },
    shareFile: async (uri) => { events.push({ uri }); },
    ...overrides,
  };
}

test('calendar navigation handles month/year/leap/DST boundaries without UTC shifts', () => {
  for (const [day, delta, expected] of [
    ['2026-10-01', -1, '2026-09-30'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2024-03-01', -1, '2024-02-29'],
    ['2026-03-08', 1, '2026-03-09'],
    ['2026-11-01', -1, '2026-10-31'],
  ]) assert.equal(shiftLocalDay(day, delta), expected);
  assert.throws(() => shiftLocalDay('2026-02-30', 1));
  assert.throws(() => shiftLocalDay('invalid', -1));
});

test('JSON export is versioned, lossless, and contains no demo activity', () => {
  const content = makeExportDocument(data, now);
  const parsed = JSON.parse(content);
  assert.equal(parsed.format, 'unified-fitness');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.exportedAt, now.toISOString());
  assert.deepEqual(parsed.profile, data.profile);
  assert.deepEqual(parsed.meals, [meal]);
  assert.equal(parsed.meals[0].kcal, null);
  assert.equal('activity' in parsed, false);
  assert.equal('targets' in parsed, false);
  assert.deepEqual(JSON.parse(makeExportDocument({ profile: null, meals: [] }, now)).meals, []);
});

test('export reads local snapshot, writes JSON, then opens share sheet without network', async () => {
  const events = [];
  let reads = 0;
  await shareLocalExport(() => { reads++; return data; }, platform(events), now);
  assert.equal(reads, 1);
  assert.equal(events.length, 2);
  assert.match(events[0].name, /^unified-fitness-[\w-]+\.json$/);
  assert.deepEqual(JSON.parse(events[0].content).meals, [meal]);
  assert.equal(events[1].uri, 'file:///private/test-export.json');
});

test('unavailable sharing does not read data or create an export file', async () => {
  const events = [];
  await assert.rejects(shareLocalExport(() => { throw new Error('Should not read'); }, platform(events, {
    isAvailable: async () => false,
  }), now), /Sharing is not available/);
  assert.deepEqual(events, []);
});

test('snapshot or disk failures do not open a share sheet', async () => {
  const events = [];
  await assert.rejects(shareLocalExport(() => { throw new Error('Read failed'); }, platform(events), now), /Read failed/);
  await assert.rejects(shareLocalExport(() => data, platform(events, {
    writeFile: async () => { throw new Error('Disk full'); },
  }), now), /Disk full/);
  assert.deepEqual(events, []);
});

test('share failure leaves source data unchanged and export can be retried', async () => {
  const events = [];
  const before = structuredClone(data);
  await assert.rejects(shareLocalExport(() => data, platform(events, {
    shareFile: async () => { throw new Error('Share failed'); },
  }), now), /Share failed/);
  assert.deepEqual(data, before);
  await shareLocalExport(() => data, platform(events), now);
  assert.deepEqual(data, before);
});
