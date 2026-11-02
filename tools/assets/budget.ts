/**
 * Asset budget gate (`0-08`, the size half of `V-11`).
 *
 *   npm run assets:check
 *
 * Weighs `src/assets/data/` against the limits in `src/app/core/data/assets.ts`: the whole
 * directory within 25 MiB, the set the app fetches before first paint within 4 MiB. The load list
 * comes from `ASSETS` — the same constant `PaleoDataService.load()` reads — so a file added to the
 * eager path is weighed as eager without anyone remembering to update a second list.
 *
 * Deploy is GitHub Pages and the app is a visualisation people open once out of curiosity: the
 * first-load number decides whether they see anything before they leave.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { BUDGET, EAGER } from '../../src/app/core/data/assets.ts';

const DATA = join(process.cwd(), 'src', 'assets', 'data');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const kib = (b: number) => `${(b / 1024).toFixed(0)} KiB`;
const mib = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MiB`;

const files = walk(DATA)
  .map(p => ({ rel: relative(DATA, p).split(sep).join('/'), bytes: statSync(p).size }))
  .sort((a, b) => b.bytes - a.bytes);

const eager = new Set(EAGER);
const unknownEager = EAGER.filter(r => !files.some(f => f.rel === r));

const total = files.reduce((s, f) => s + f.bytes, 0);
const firstLoad = files.filter(f => eager.has(f.rel)).reduce((s, f) => s + f.bytes, 0);

console.log('src/assets/data — per file\n');
for (const f of files) {
  console.log(`  ${eager.has(f.rel) ? 'eager' : '     '}  ${f.bytes.toString().padStart(9)}  ${kib(f.bytes).padStart(9)}  ${f.rel}`);
}

const rows = [
  { what: 'first load (eager)', bytes: firstLoad, limit: BUDGET.firstLoadBytes },
  { what: 'all assets', bytes: total, limit: BUDGET.totalBytes }
];

console.log('\nbudget\n');
let failed = 0;
for (const r of rows) {
  const ok = r.bytes <= r.limit;
  const pct = ((r.bytes / r.limit) * 100).toFixed(0);
  console.log(`  ${ok ? '✓' : '✗'} ${r.what.padEnd(19)} ${mib(r.bytes).padStart(10)} of ${mib(r.limit).padStart(10)}  (${pct}%)`);
  if (!ok) failed++;
}

// An eager path that no longer exists means the app is fetching a 404 on startup, or the constant
// drifted. Either way the budget above is measuring the wrong set, so it fails here.
for (const rel of unknownEager) {
  console.log(`  ✗ eager asset missing from src/assets/data: ${rel}`);
  failed++;
}

if (failed) {
  console.error(`\n${failed} budget check(s) failed`);
  process.exit(1);
}
console.log(`\n${files.length} file(s), ${EAGER.length} on the first load — within budget`);
