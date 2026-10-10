import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { verifyTestBaseline } from '../scripts/check-test-baseline.mjs';

const report = (tests, pass = tests) => `TAP version 13\n1..${tests}\n# tests ${tests}\n# suites 0\n# pass ${pass}\n# fail ${tests - pass}\n# cancelled 0\n# skipped 0\n`;

test('CI baseline accepts passing TAP summaries and rejects dropped, skipped or malformed suites', () => {
  assert.equal(verifyTestBaseline(report(120), 114), 120);
  for (const output of [report(113), report(114, 113), report(120, 119), 'no test summary', report(114).replace('# pass 114', '# pass invalid')]) assert.throws(() => verifyTestBaseline(output, 114));
  assert.throws(() => verifyTestBaseline(report(114), 0));
});

test('CI runs unprivileged PR verification using mature SHA-pinned actions and the frozen Yarn lockfile', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/mobile-ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.equal(workflow.includes('pull_request_target'), false);
  assert.equal(workflow.includes('secrets.'), false);
  assert.match(workflow, /contents: read/);
  const actions = [...workflow.matchAll(/uses: ([^\n]+)/g)].map((match) => match[1]);
  assert.equal(actions.length, 2);
  for (const action of actions) assert.match(action, /^actions\/(checkout|setup-node)@[a-f0-9]{40}$/);
  for (const command of ['yarn install --frozen-lockfile', 'yarn check:config', 'yarn typecheck', 'node --test --test-reporter=tap', 'check-test-baseline.mjs', 'expo export --platform ios', 'expo export --platform android']) assert.ok(workflow.includes(command), command);
  for (const flag of ['NUTRITION','PHOTO_ESTIMATES','VOICE']) assert.match(workflow, new RegExp(`EXPO_PUBLIC_${flag}_ENABLED: 'false'`));
  assert.equal(workflow.includes('smoke-voice'), false);
  assert.equal(workflow.includes('supabase db push'), false);
});
