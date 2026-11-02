/**
 * Validation report (`V-01`).
 *
 *   npm run validate
 *
 * Runs the registry in `checks.ts` and prints one row per check: what the model says, what it is
 * held to, and how far apart they are. Exits non-zero if a `blocking` check fails, so it can stand
 * in a pipeline or a CI job. `npm run data:build` will call it once that script exists (`0-04`).
 *
 * The deviation column is the reason this is a table and not a list of ticks: every row carries a
 * number, including the rows that pass, so the size of a disagreement stays visible instead of
 * collapsing into a green mark.
 */
import { runChecks } from './checks.ts';

const results = await runChecks();
const mark = (pass: boolean | null) => (pass === null ? '·' : pass ? '✓' : '✗');

console.log('\nValidation report — V-01\n');
for (const r of results) {
  console.log(`  ${mark(r.pass)} ${r.id}   [${r.status}]`);
  console.log(`      model     ${r.value}`);
  console.log(`      expected  ${r.expected}`);
  console.log(`      deviation ${r.deviation}`);
  if (r.note) console.log(`      note      ${r.note}`);
  for (const line of r.detail ?? []) console.log(`      ${line}`);
  console.log();
}

const blocking = results.filter(r => r.status === 'blocking');
const failed = blocking.filter(r => r.pass === false);
const reporting = results.filter(r => r.status === 'reporting');
console.log(
  `  ${blocking.length - failed.length} of ${blocking.length} blocking checks pass, ` +
    `${reporting.length} measurement(s) reported\n`
);

if (failed.length) {
  console.error(`validation failed: ${failed.map(r => r.id).join(', ')}\n`);
  process.exit(1);
}
