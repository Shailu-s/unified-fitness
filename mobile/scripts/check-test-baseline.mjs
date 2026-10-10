import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyTestBaseline(report, minimum) {
  if (!Number.isSafeInteger(minimum) || minimum < 1) throw new Error('Invalid test baseline.');
  const tests = Number(report.match(/^# tests (\d+)\s*$/m)?.[1]);
  const passed = Number(report.match(/^# pass (\d+)\s*$/m)?.[1]);
  if (!Number.isSafeInteger(tests) || !Number.isSafeInteger(passed) || passed !== tests) throw new Error('Missing, invalid or non-passing TAP summary.');
  if (passed < minimum) throw new Error(`Passing tests ${passed} are below the reviewed baseline ${minimum}.`);
  return passed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const passed = verifyTestBaseline(readFileSync(process.argv[2], 'utf8'), Number(process.argv[3]));
    console.log(`Verified ${passed} passing tests against baseline ${process.argv[3]}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not verify test baseline.');
    process.exitCode = 1;
  }
}
